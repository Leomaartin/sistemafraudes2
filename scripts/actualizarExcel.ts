import path from "path";
import fs from "fs";
import { procesarExcelUsuarios } from "../lib/procesadorExcel";
import { prisma } from "../lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const esDryRun = args.includes("--dry-run");

  // Buscar ruta del archivo Excel en los argumentos
  let rutaExcel = args.find((a) => !a.startsWith("--"));

  if (!rutaExcel) {
    const rutasCandidatas = [
      path.join(process.cwd(), "migracion", "usuarios_nuevo.xlsx"),
      path.join(process.cwd(), "usuarios_nuevo.xlsx"),
      path.join(process.cwd(), "migracion", "usuarios.xlsx"),
      path.join(process.cwd(), "usuarios.xlsx"),
      path.join(process.cwd(), "migracion", "usuarios_nuevo.xls"),
      path.join(process.cwd(), "usuarios_nuevo.xls"),
      path.join(process.cwd(), "migracion", "usuarios.xls"),
      path.join(process.cwd(), "usuarios.xls"),
    ];

    for (const r of rutasCandidatas) {
      if (fs.existsSync(r)) {
        rutaExcel = r;
        break;
      }
    }
  }

  console.log("\n=======================================================");
  console.log("📊 ACTUALIZADOR Y MIGRACIÓN INTELIGENTE DE EXCEL");
  console.log("   (Sincronización por N° Usuario / Nombre)");
  console.log("=======================================================\n");

  if (!rutaExcel || !fs.existsSync(rutaExcel)) {
    console.log("⚠️  No se encontró ningún archivo Excel automáticamente.");
    console.log("📁 Podés indicar el archivo pasando la ruta como parámetro:");
    console.log('   npx tsx scripts/actualizarExcel.ts "C:/ruta/a/tu/archivo.xlsx" [--dry-run]\n');
    console.log("O podés colocar el archivo en:");
    console.log("   -> migracion/usuarios.xlsx");
    console.log("   -> ./usuarios.xlsx\n");
    process.exit(1);
  }

  console.log(`📄 Archivo detectado: ${rutaExcel}`);
  console.log(`⚙️  Modo de ejecución: ${esDryRun ? "🔍 DRY-RUN (Simulación, no altera la base de datos)" : "⚡ ACTUALIZACIÓN REAL EN BASE DE DATOS"}`);
  console.log("🛡️  Protección de coordenadas: La latitud y longitud existentes están 100% protegidas.\n");

  console.log("⏳ Leyendo y analizando archivo Excel contra la base de datos...");
  const inicio = Date.now();

  try {
    const resultado = await procesarExcelUsuarios({
      rutaArchivo: rutaExcel,
      esDryRun,
    });

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log("\n=======================================================");
    console.log("📋 COLUMNAS RECONOCIDAS EN EL EXCEL");
    console.log("=======================================================");
    for (const [campo, columna] of Object.entries(resultado.columnasMapeadas)) {
      if (columna) {
        console.log(`   ✓ ${campo.padEnd(16)} ➔ "${columna}"`);
      } else {
        console.log(`   — ${campo.padEnd(16)} (No presente en el Excel)`);
      }
    }

    if (resultado.tarifasCreadas.length > 0) {
      console.log(`\n⚡ Tarifas nuevas registradas: ${resultado.tarifasCreadas.join(", ")}`);
    }
    if (resultado.estadosCreados.length > 0) {
      console.log(`\n📌 Estados nuevos registrados: ${resultado.estadosCreados.join(", ")}`);
    }

    console.log("\n=======================================================");
    console.log("📈 RESUMEN DE PROCESAMIENTO");
    console.log("=======================================================");
    console.log(`Total filas en el archivo:             ${resultado.totalFilas.toLocaleString()}`);
    console.log(`Usuarios únicos identificados:         ${resultado.usuariosLeidos.toLocaleString()}`);
    console.log(`Usuarios ya existentes en base:        ${resultado.usuariosEncontrados.toLocaleString()}`);
    console.log(`  ├─ 🔄 Con modificaciones aplicadas:  ${resultado.usuariosModificados.toLocaleString()}`);
    console.log(`  └─ ⏸️  Sin cambios (datos idénticos): ${resultado.usuariosSinCambios.toLocaleString()}`);
    console.log(`✨ Nuevos usuarios agregados:          ${resultado.usuariosCreados.toLocaleString()}`);
    console.log(`🛡️  Coordenadas (Lat/Lng) preservadas:  ${resultado.coordenadasPreservadas.toLocaleString()}`);
    console.log(`⏱️  Tiempo de procesamiento:           ${duracion} segundos`);

    if (resultado.detallesMuestra.length > 0) {
      console.log("\n=======================================================");
      console.log("🔍 MUESTRA DE CAMBIOS DETECTADOS (Primeros registros)");
      console.log("=======================================================");
      for (const item of resultado.detallesMuestra.slice(0, 15)) {
        if (item.esNuevo) {
          console.log(`🟢 [NUEVO] N° ${item.nroUsuario} - "${item.nombre}"`);
        } else {
          console.log(`🔵 [MODIFICADO] N° ${item.nroUsuario} - "${item.nombre}"`);
          for (const c of item.cambios) {
            console.log(`      ↳ ${c}`);
          }
        }
      }
    }

    if (resultado.errores.length > 0) {
      console.log("\n⚠️ Advertencias / Errores:");
      for (const err of resultado.errores.slice(0, 10)) {
        console.log(`   - ${err}`);
      }
    }

    if (esDryRun) {
      console.log("\n💡 Fin de la simulación. Ningún dato fue modificado.");
      console.log("   Para aplicar los cambios reales en la base de datos, ejecuta:");
      console.log(`   npx tsx scripts/actualizarExcel.ts "${rutaExcel}"\n`);
    } else {
      console.log("\n🎉 ¡Sincronización finalizada con éxito en PostgreSQL!\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error durante el procesamiento del Excel:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
