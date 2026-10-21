import { prisma } from "../lib/prisma";
import { normalizarDireccionBase } from "../lib/domicilioUtils";

interface OpcionesScript {
  simular: boolean;
  soloVariaciones: boolean;
  unificarCoordenadas: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const opciones: OpcionesScript = {
    simular: args.includes("--simular") || args.includes("--dry-run"),
    soloVariaciones: args.includes("--solo-variaciones"),
    unificarCoordenadas: !args.includes("--no-unificar-coords"),
  };

  console.log("\n================================================================================");
  console.log("🏢 SCRIPT DE DETECCIÓN Y CONVERSIÓN DE EDIFICIOS / DEPARTAMENTOS ACUMULADOS 🏢");
  console.log("================================================================================");
  console.log(`Modo de ejecución: ${opciones.simular ? "🔍 SIMULACIÓN (No modifica la base de datos)" : "🚀 APLICACIÓN REAL EN BASE DE DATOS"}`);
  console.log(`Filtro de grupos: ${opciones.soloVariaciones ? "Solo con variaciones en sufijo (ej: Bis, A, PB, Dto)" : "Todos los acumulados en misma calle y altura (variaciones + idénticos)"}`);
  console.log(`Unificación de coordenadas: ${opciones.unificarCoordenadas ? "SI (Hereda y alinea coordenadas de edificio)" : "NO"}`);
  console.log("--------------------------------------------------------------------------------\n");

  console.log("1. Cargando padrón de usuarios desde la base de datos...");
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      esDepartamento: true,
      idEstadoDepto: true,
      latitud: true,
      longitud: true,
      maps: true,
      estado: {
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  });

  console.log(`   Total de usuarios en base de datos: ${usuarios.length}`);

  console.log("2. Agrupando domicilios por calle y altura base normalizada...");
  const gruposEdificios = new Map<string, typeof usuarios>();

  for (const u of usuarios) {
    if (!u.domicilio) continue;
    const base = normalizarDireccionBase(u.domicilio);
    // Debe tener calle y altura numérica válida
    if (!base || !/\d+/.test(base)) continue;

    if (!gruposEdificios.has(base)) {
      gruposEdificios.set(base, []);
    }
    gruposEdificios.get(base)!.push(u);
  }

  // Filtrar grupos con 2 o más usuarios
  interface EdificioAProcesar {
    base: string;
    titulo: string;
    usuarios: typeof usuarios;
    tieneVariaciones: boolean;
    domiciliosDistintos: string[];
    coordEdificio: { lat: number; lng: number } | null;
  }

  const edificiosAProcesar: EdificioAProcesar[] = [];

  for (const [base, grupo] of gruposEdificios.entries()) {
    if (grupo.length < 2) continue;

    const domiciliosUnicos = Array.from(
      new Set(grupo.map((u) => u.domicilio?.trim() || ""))
    );
    const tieneVariaciones = domiciliosUnicos.length > 1;

    if (opciones.soloVariaciones && !tieneVariaciones) {
      continue;
    }

    // Determinar la mejor coordenada para el edificio (la más frecuente o la primera válida)
    let coordEdificio: { lat: number; lng: number } | null = null;
    const usuariosConCoord = grupo.filter(
      (u) => u.latitud !== null && u.longitud !== null
    );

    if (usuariosConCoord.length > 0) {
      // Buscar coordenada de mayor frecuencia entre los departamentos
      const conteoCoords = new Map<string, { count: number; lat: number; lng: number }>();
      for (const uc of usuariosConCoord) {
        const key = `${Number(uc.latitud).toFixed(5)},${Number(uc.longitud).toFixed(5)}`;
        if (!conteoCoords.has(key)) {
          conteoCoords.set(key, { count: 0, lat: Number(uc.latitud), lng: Number(uc.longitud) });
        }
        conteoCoords.get(key)!.count++;
      }

      let mejorCoord = { lat: Number(usuariosConCoord[0].latitud), lng: Number(usuariosConCoord[0].longitud) };
      let maxCount = 0;
      for (const item of conteoCoords.values()) {
        if (item.count > maxCount) {
          maxCount = item.count;
          mejorCoord = { lat: item.lat, lng: item.lng };
        }
      }
      coordEdificio = mejorCoord;
    }

    const titulo = base
      .split(" ")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

    edificiosAProcesar.push({
      base,
      titulo,
      usuarios: grupo,
      tieneVariaciones,
      domiciliosDistintos: domiciliosUnicos,
      coordEdificio,
    });
  }

  // Ordenar de mayor a menor cantidad de departamentos
  edificiosAProcesar.sort((a, b) => b.usuarios.length - a.usuarios.length);

  // Estadísticas preliminares
  let totalUsuariosEnEdificios = 0;
  let usuariosYaEranDepto = 0;
  let usuariosQueSeranDepto = 0;
  let usuariosQueHeredaranCoords = 0;

  const updatesList: {
    id: number;
    nroUsuario: string;
    cambiaEsDepto: boolean;
    nuevaLat?: number;
    nuevaLng?: number;
    nuevoMaps?: string;
  }[] = [];

  for (const ed of edificiosAProcesar) {
    totalUsuariosEnEdificios += ed.usuarios.length;

    for (const u of ed.usuarios) {
      const necesitaMarcarDepto = !u.esDepartamento;
      let necesitaCoord = false;
      let nuevaLat: number | undefined = undefined;
      let nuevaLng: number | undefined = undefined;
      let nuevoMaps: string | undefined = undefined;

      if (opciones.unificarCoordenadas && ed.coordEdificio) {
        const tieneCoord = u.latitud !== null && u.longitud !== null;
        if (!tieneCoord) {
          necesitaCoord = true;
          usuariosQueHeredaranCoords++;
          nuevaLat = Number(ed.coordEdificio.lat.toFixed(7));
          nuevaLng = Number(ed.coordEdificio.lng.toFixed(7));
          nuevoMaps = `https://www.google.com/maps?q=${nuevaLat.toFixed(6)},${nuevaLng.toFixed(6)}`;
        } else {
          // Si difiere levemente de la coordenada unificada del edificio
          const diffLat = Math.abs(Number(u.latitud) - ed.coordEdificio.lat);
          const diffLng = Math.abs(Number(u.longitud) - ed.coordEdificio.lng);
          if (diffLat > 0.00001 || diffLng > 0.00001) {
            necesitaCoord = true;
            nuevaLat = Number(ed.coordEdificio.lat.toFixed(7));
            nuevaLng = Number(ed.coordEdificio.lng.toFixed(7));
            nuevoMaps = `https://www.google.com/maps?q=${nuevaLat.toFixed(6)},${nuevaLng.toFixed(6)}`;
          }
        }
      }

      if (necesitaMarcarDepto) {
        usuariosQueSeranDepto++;
      } else {
        usuariosYaEranDepto++;
      }

      if (necesitaMarcarDepto || necesitaCoord) {
        updatesList.push({
          id: u.id,
          nroUsuario: u.nroUsuario,
          cambiaEsDepto: necesitaMarcarDepto,
          nuevaLat,
          nuevaLng,
          nuevoMaps,
        });
      }
    }
  }

  console.log("3. Resumen de Edificios y Departamentos Detectados:");
  console.log(`   - Total de Edificios / Direcciones Agrupadas: ${edificiosAProcesar.length}`);
  console.log(`   - Total de Departamentos / Clientes Acumulados: ${totalUsuariosEnEdificios}`);
  console.log(`   - Usuarios que ya tenían esDepartamento = true: ${usuariosYaEranDepto}`);
  console.log(`   - Usuarios a transformar a esDepartamento = true: ${usuariosQueSeranDepto}`);
  console.log(`   - Usuarios que recibirán o unificarán coordenadas GPS: ${updatesList.filter((u) => u.nuevaLat !== undefined).length}`);
  console.log(`     (De los cuales ${usuariosQueHeredaranCoords} no tenían ninguna coordenada y ahora se verán en el mapa)`);
  console.log("--------------------------------------------------------------------------------\n");

  console.log("🏢 TOP 15 EDIFICIOS CON MÁS DEPARTAMENTOS REGISTRADOS:\n");
  for (let i = 0; i < Math.min(15, edificiosAProcesar.length); i++) {
    const ed = edificiosAProcesar[i];
    console.log(`  ${i + 1}. ${ed.titulo.padEnd(25)} | ${ed.usuarios.length} deptos | Variaciones: ${ed.domiciliosDistintos.slice(0, 4).join(", ")}${ed.domiciliosDistintos.length > 4 ? "..." : ""}`);
  }
  console.log("");

  if (opciones.simular) {
    console.log("ℹ️  Modo SIMULACIÓN finalizado. No se realizaron cambios en la base de datos.");
    console.log("👉 Para aplicar estos cambios definitivamente en la base de datos y mapa, ejecuta:");
    console.log("   npx tsx scripts/convertirDeptosAcumulados.ts\n");
    return;
  }

  // APLICACIÓN REAL EN BASE DE DATOS
  console.log(`4. Aplicando cambios a ${updatesList.length} usuarios en la base de datos...`);
  const batchSize = 100;
  let aplicados = 0;

  for (let i = 0; i < updatesList.length; i += batchSize) {
    const batch = updatesList.slice(i, i + batchSize);

    await prisma.$transaction(
      batch.map((up) => {
        const dataToUpdate: any = {
          esDepartamento: true,
        };
        if (up.nuevaLat !== undefined && up.nuevaLng !== undefined) {
          dataToUpdate.latitud = up.nuevaLat;
          dataToUpdate.longitud = up.nuevaLng;
          if (up.nuevoMaps) {
            dataToUpdate.maps = up.nuevoMaps;
          }
        }
        return prisma.usuario.update({
          where: { id: up.id },
          data: dataToUpdate,
        });
      })
    );

    aplicados += batch.length;
    process.stdout.write(`   Progreso: ${aplicados}/${updatesList.length} (${Math.round((aplicados / updatesList.length) * 100)}%)\r`);
  }

  console.log(`\n\n✅ ¡Proceso completado con éxito!`);
  console.log(`   - ${usuariosQueSeranDepto} usuarios actualizados a esDepartamento = true.`);
  console.log(`   - ${updatesList.filter((u) => u.nuevaLat !== undefined).length} coordenadas GPS sincronizadas/heredadas.`);
  console.log(`   - Todos estos usuarios ahora se agrupan en el mapa con su marcador de edificio 🏢 desplegable.`);
  console.log("================================================================================\n");
}

main()
  .catch((err) => {
    console.error("❌ Error durante la ejecución del script:", err);
  })
  .finally(() => prisma.$disconnect());
