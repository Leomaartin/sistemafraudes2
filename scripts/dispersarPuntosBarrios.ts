import { prisma } from "../lib/prisma";
import { esBarrioOLoteo } from "../lib/domicilioUtils";

interface OpcionesScript {
  ejecutar: boolean;
}

/**
 * Genera un desplazamiento determinista (jitter) suave y realista
 * para repartir puntos apilados dentro del radio del barrio o loteo.
 */
function calcularDesplazamientoLote(
  id: number,
  nroUsuario: string,
  indiceEnGrupo: number,
  totalEnGrupo: number,
  radioMaximoGrados: number = 0.0018 // ~150-200 metros
): { dLat: number; dLng: number } {
  // Distribución en espiral de Fermat / Golden Ratio para óptima separación visual
  const phi = (1 + Math.sqrt(5)) / 2; // Golden ratio
  const angle = indiceEnGrupo * 2 * Math.PI * phi;
  // Radio proporcional a la raíz del índice para densidad uniforme
  const r = (Math.sqrt((indiceEnGrupo + 1) / totalEnGrupo)) * radioMaximoGrados;

  const dLat = Math.sin(angle) * r;
  const dLng = Math.cos(angle) * r * 1.2; // Compensación por longitud en Argentina (-34° lat)

  return { dLat, dLng };
}

async function main() {
  const args = process.argv.slice(2);
  const opciones: OpcionesScript = {
    ejecutar: args.includes("--ejecutar") || args.includes("--aplicar"),
  };

  console.log("\n================================================================================");
  console.log("📍 SCRIPT DE DISPERSIÓN INTELIGENTE: PUNTOS APILADOS EN BARRIOS Y LOTEOS");
  console.log("================================================================================");
  console.log(
    `Modo: ${
      opciones.ejecutar
        ? "🚀 EJECUCIÓN REAL (Se actualizarán coordenadas en la base de datos)"
        : "🔍 MODO SIMULACIÓN (Seguro: No modifica nada. Usa --ejecutar para aplicar)"
    }`
  );
  console.log("Objetivo: Separar puntos encimados en barrios y loteos para verlos individualmente");
  console.log("--------------------------------------------------------------------------------\n");

  console.log("1. Buscando puntos independientes apilados en la misma coordenada...");
  const usuarios = await prisma.usuario.findMany({
    where: {
      latitud: { not: null },
      longitud: { not: null },
      esDepartamento: false, // Solo inmuebles independientes (no tocar edificios reales)
    },
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      latitud: true,
      longitud: true,
    },
    orderBy: { id: "asc" },
  });

  // Agrupar por coordenada exacta (5 decimales)
  const mapaCoords = new Map<string, typeof usuarios>();
  for (const u of usuarios) {
    const key = `${Number(u.latitud).toFixed(5)},${Number(u.longitud).toFixed(5)}`;
    if (!mapaCoords.has(key)) mapaCoords.set(key, []);
    mapaCoords.get(key)!.push(u);
  }

  // Filtrar grupos con 3 o más usuarios en la misma coordenada exacta que correspondan a barrios o loteos
  const gruposADispersar: { coordKey: string; usuarios: typeof usuarios; motivo: string }[] = [];
  let totalUsuariosADispersar = 0;

  for (const [key, lista] of mapaCoords.entries()) {
    if (lista.length < 3) continue;

    // Verificar si al menos uno o la mayoría son barrios, lotes, o direcciones abiertas
    const sonDeBarrio = lista.filter((u) => esBarrioOLoteo(u.domicilio));

    // Si al menos la mitad de los apilados son de barrio o loteo, o todos tienen lote/manzana
    if (sonDeBarrio.length >= lista.length * 0.4 || sonDeBarrio.length >= 3) {
      gruposADispersar.push({
        coordKey: key,
        usuarios: lista,
        motivo: `${lista.length} usuarios apilados en barrio/loteo`,
      });
      totalUsuariosADispersar += lista.length;
    }
  }

  console.log(`   Grupos masivos apilados en barrios detectados: ${gruposADispersar.length}`);
  console.log(`   Total de usuarios a dispersar en sus barrios: ${totalUsuariosADispersar}`);

  if (gruposADispersar.length === 0) {
    console.log("\n✅ ¡No hay grupos masivos apilados en barrios que requieran dispersión!");
    return;
  }

  console.log("\n2. Principales grupos que se distribuirán en sus barrios:");
  gruposADispersar.sort((a, b) => b.usuarios.length - a.usuarios.length);

  for (let i = 0; i < Math.min(10, gruposADispersar.length); i++) {
    const g = gruposADispersar[i];
    console.log(`\n🔹 Grupo #${i + 1} [${g.coordKey}] — ${g.usuarios.length} usuarios apilados:`);
    for (const u of g.usuarios.slice(0, 4)) {
      console.log(`   - ID #${u.id} (Cuenta: ${u.nroUsuario}) | "${u.nombre}" | Dom: "${u.domicilio}"`);
    }
    if (g.usuarios.length > 4) {
      console.log(`   ... y ${g.usuarios.length - 4} usuarios más en esta misma coordenada.`);
    }
  }

  // Preparar actualizaciones
  const updates: { id: number; lat: number; lng: number; maps: string }[] = [];

  for (const g of gruposADispersar) {
    const [baseLatStr, baseLngStr] = g.coordKey.split(",");
    const baseLat = parseFloat(baseLatStr);
    const baseLng = parseFloat(baseLngStr);

    // Ajustar el radio de dispersión según la cantidad de usuarios
    // Si son 100 usuarios, un radio de 250m (~0.0025); si son 5, unos 80m (~0.0008)
    const radio = Math.min(0.003, Math.max(0.0008, Math.sqrt(g.usuarios.length) * 0.0003));

    g.usuarios.forEach((u, idx) => {
      // Dejar el primer usuario en el centro original y dispersar a los demás
      if (idx === 0) return;

      const { dLat, dLng } = calcularDesplazamientoLote(
        u.id,
        u.nroUsuario,
        idx,
        g.usuarios.length,
        radio
      );

      const nuevaLat = Number((baseLat + dLat).toFixed(7));
      const nuevaLng = Number((baseLng + dLng).toFixed(7));
      const nuevoMaps = `https://www.google.com/maps?q=${nuevaLat.toFixed(6)},${nuevaLng.toFixed(6)}`;

      updates.push({
        id: u.id,
        lat: nuevaLat,
        lng: nuevaLng,
        maps: nuevoMaps,
      });
    });
  }

  console.log(`\n3. Total de coordenadas a recalcular y dispersar: ${updates.length}`);

  if (opciones.ejecutar) {
    console.log("\n4. Aplicando coordenadas dispersas en la base de datos...");
    let modificados = 0;

    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      await prisma.$transaction(
        batch.map((up) =>
          prisma.usuario.update({
            where: { id: up.id },
            data: {
              latitud: up.lat,
              longitud: up.lng,
              maps: up.maps,
            },
          })
        )
      );
      modificados += batch.length;
      console.log(`   Actualizados: ${modificados}/${updates.length} usuarios...`);
    }

    console.log("\n================================================================================");
    console.log(`✅ ¡DISPERSIÓN EXITOSA!`);
    console.log(`   Se dispersaron ${modificados} usuarios apilados.`);
    console.log(`   Ahora cada lote/casa se visualizará de forma individual en el mapa.`);
    console.log("================================================================================\n");
  } else {
    console.log("\n================================================================================");
    console.log("👉 Para aplicar la dispersión real en la base de datos, ejecuta:");
    console.log("   npm run dispersar:barrios -- --ejecutar");
    console.log("   o directamente:");
    console.log("   npx tsx scripts/dispersarPuntosBarrios.ts --ejecutar");
    console.log("================================================================================\n");
  }
}

main()
  .catch((err) => {
    console.error("❌ Error en script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
