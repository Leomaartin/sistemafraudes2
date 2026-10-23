import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import { esBarrioOLoteo } from "../lib/domicilioUtils";

interface OpcionesScript {
  ejecutar: boolean;
}

interface ItemDesmarcar {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string;
  estadoDeptoAnterior: string | null;
  categoriaBarrio: string;
}

function categorizarZonaBarrio(domicilio: string): string {
  const s = domicilio.toLowerCase();
  if (s.includes("florida")) return "Barrio La Florida / Fincas";
  if (s.includes("ceibos")) return "Barrio Los Ceibos";
  if (s.includes("robles")) return "Barrio Los Robles";
  if (s.includes("mirtillos")) return "Barrio Los Mirtillos I/II";
  if (s.includes("marias") || s.includes("mariñas")) return "Barrio Las Marías / Las Mariñas";
  if (s.includes("acacias")) return "Barrio Las Acacias";
  if (s.includes("victoria")) return "Barrio Victoria";
  if (s.includes("aldea suiza")) return "Aldea Suiza";
  if (s.includes("smithfield")) return "Barrio Smithfield";
  if (s.includes("campiña")) return "Barrio La Campiña";
  if (s.includes("carona")) return "Barrio La Carona";
  if (s.includes("picadas")) return "Las Picadas";
  if (s.includes("naranjos")) return "Los Naranjos";
  if (s.includes("candelaria")) return "La Candelaria";
  if (s.includes("ruta") || s.includes("km")) return "Rutas y Parajes Rurales (Km)";
  if (/\b(lote|lt|l\.)\s*\d+/i.test(s)) return "Loteos y Parcelas";
  if (/\b(manzana|mza|mz|m\.)\s*\d+/i.test(s)) return "Manzanas y Sectores";
  if (/\b(barrio|b°|bo\.)/i.test(s)) return "Otros Barrios Abiertos / Cerrados";
  return "Otras Zonas Independientes";
}

async function main() {
  const args = process.argv.slice(2);
  const opciones: OpcionesScript = {
    ejecutar: args.includes("--ejecutar") || args.includes("--aplicar"),
  };

  console.log("\n================================================================================");
  console.log("🏡 SCRIPT DE CORRECCIÓN: DESMARCAR FALSOS DEPARTAMENTOS EN BARRIOS Y LOTEOS");
  console.log("================================================================================");
  console.log(
    `Modo: ${
      opciones.ejecutar
        ? "🚀 EJECUCIÓN REAL (Se aplicarán cambios en la base de datos)"
        : "🔍 MODO SIMULACIÓN (Seguro: No modifica nada. Usa --ejecutar para aplicar)"
    }`
  );
  console.log("Criterio: Domicilios con barrios, lotes, manzanas, quintas y rutas km");
  console.log("Acción: Desmarcar 'esDepartamento' e 'idEstadoDepto' -> Convertir a INDEPENDIENTE");
  console.log("--------------------------------------------------------------------------------\n");

  console.log("1. Cargando usuarios marcados como departamento...");
  const usuariosDeptos = await prisma.usuario.findMany({
    where: {
      OR: [{ esDepartamento: true }, { idEstadoDepto: { not: null } }],
    },
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      esDepartamento: true,
      idEstadoDepto: true,
      estadoDepto: { select: { nombre: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`   Total de usuarios con check de departamento: ${usuariosDeptos.length}`);

  console.log("2. Analizando direcciones para detectar inmuebles en barrios y loteos...");
  const aDesmarcar: ItemDesmarcar[] = [];
  const conservadosEdificiosUrbanos: typeof usuariosDeptos = [];

  for (const u of usuariosDeptos) {
    if (esBarrioOLoteo(u.domicilio)) {
      aDesmarcar.push({
        id: u.id,
        nroUsuario: u.nroUsuario,
        nombre: u.nombre,
        domicilio: u.domicilio || "",
        estadoDeptoAnterior: u.estadoDepto?.nombre || null,
        categoriaBarrio: categorizarZonaBarrio(u.domicilio || ""),
      });
    } else {
      conservadosEdificiosUrbanos.push(u);
    }
  }

  console.log(`\n📊 RESULTADO DEL DIAGNÓSTICO:`);
  console.log(`   - Falsos departamentos a desmarcar (Casas en Barrios/Lotes): ${aDesmarcar.length}`);
  console.log(`   - Departamentos legítimos conservados (Edificios urbanos reales): ${conservadosEdificiosUrbanos.length}`);

  if (aDesmarcar.length === 0) {
    console.log("\n✅ ¡No se detectaron falsos departamentos en barrios!");
    return;
  }

  // Agrupar por categoría de barrio
  const conteoPorCategoria = new Map<string, ItemDesmarcar[]>();
  for (const item of aDesmarcar) {
    if (!conteoPorCategoria.has(item.categoriaBarrio)) {
      conteoPorCategoria.set(item.categoriaBarrio, []);
    }
    conteoPorCategoria.get(item.categoriaBarrio)!.push(item);
  }

  console.log("\n📍 DISTRIBUCIÓN POR ZONA / BARRIO:");
  for (const [cat, lista] of Array.from(conteoPorCategoria.entries()).sort(
    (a, b) => b[1].length - a[1].length
  )) {
    console.log(`   • ${cat.padEnd(38, " ")}: ${lista.length} usuarios`);
  }

  console.log("\n================================================================================");
  console.log("MUESTRA DE USUARIOS QUE PASARÁN A SER PUNTOS INDEPENDIENTES:");
  console.log("================================================================================");
  for (let i = 0; i < Math.min(20, aDesmarcar.length); i++) {
    const item = aDesmarcar[i];
    console.log(
      `${(i + 1).toString().padStart(3, " ")}. ID #${item.id} (Cuenta: ${item.nroUsuario}) | "${item.nombre}"`
    );
    console.log(`     📍 Domicilio: "${item.domicilio}" [${item.categoriaBarrio}]`);
    console.log(`     🏷️  Cambio: esDepartamento = false, idEstadoDepto = null`);
  }

  if (aDesmarcar.length > 20) {
    console.log(`   ... y ${aDesmarcar.length - 20} usuarios más en el reporte completo.`);
  }

  // Exportar reportes
  const rutaTxt = path.join(process.cwd(), "scripts", "reporte_barrios_desmarcados.txt");
  const rutaJson = path.join(process.cwd(), "scripts", "reporte_barrios_desmarcados.json");

  const lineasTxt = [
    "================================================================================",
    "REPORTE DE USUARIOS EN BARRIOS Y LOTEOS DESMARCADOS COMO DEPARTAMENTOS",
    `Generado: ${new Date().toLocaleString("es-AR")}`,
    `Total a convertir a independientes: ${aDesmarcar.length}`,
    "================================================================================\n",
  ];

  aDesmarcar.forEach((item, index) => {
    lineasTxt.push(
      `#${index + 1} | ID: ${item.id} | CUENTA: ${item.nroUsuario} | NOMBRE: ${item.nombre}`
    );
    lineasTxt.push(`   DOMICILIO: "${item.domicilio}"`);
    lineasTxt.push(`   ZONA: ${item.categoriaBarrio}`);
    lineasTxt.push(`   ESTADO ANTERIOR: ${item.estadoDeptoAnterior || "SIN ESTADO DEPTO"}`);
    lineasTxt.push(`   NUEVO ESTADO: INDEPENDIENTE (esDepartamento: false, idEstadoDepto: null)\n`);
  });

  fs.writeFileSync(rutaTxt, lineasTxt.join("\n"), "utf-8");
  fs.writeFileSync(rutaJson, JSON.stringify(aDesmarcar, null, 2), "utf-8");

  console.log("\n📁 Reportes generados:");
  console.log(`   - Texto legible: scripts/reporte_barrios_desmarcados.txt`);
  console.log(`   - JSON: scripts/reporte_barrios_desmarcados.json`);

  if (opciones.ejecutar) {
    console.log("\n3. Aplicando cambios en la base de datos...");
    const ids = aDesmarcar.map((x) => x.id);

    // Actualizar en lotes de 200
    const BATCH_SIZE = 200;
    let actualizados = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const res = await prisma.usuario.updateMany({
        where: { id: { in: batchIds } },
        data: {
          esDepartamento: false,
          idEstadoDepto: null,
        },
      });
      actualizados += res.count;
      console.log(`   Actualizados: ${actualizados}/${ids.length} usuarios...`);
    }

    console.log("\n================================================================================");
    console.log(`✅ ¡CORRECCIÓN COMPLETADA CON ÉXITO!`);
    console.log(`   Total de usuarios desmarcados y convertidos a INDEPENDIENTE: ${actualizados}`);
    console.log("================================================================================\n");
  } else {
    console.log("\n================================================================================");
    console.log("👉 Para aplicar la corrección real en la base de datos, ejecuta:");
    console.log("   npm run corregir:barrios -- --ejecutar");
    console.log("   o directamente:");
    console.log("   npx tsx scripts/corregirDeptosBarrios.ts --ejecutar");
    console.log("================================================================================\n");
  }
}

main()
  .catch((err) => {
    console.error("❌ Error en script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
