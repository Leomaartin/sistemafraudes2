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
      path.join(process.cwd(), "migracion", "usuarios.csv"),
      path.join(process.cwd(), "usuarios.csv"),
    ];

    for (const r of rutasCandidatas) {
      if (fs.existsSync(r)) {
        rutaExcel = r;
        break;
      }
    }
  }

  console.log("\n=======================================================");
  console.log("🚀 MIGRACIÓN Y ACTUALIZACIÓN INTELIGENTE DE EXCEL");
  console.log("   (Alineación por N° Usuario / Nombre)");
  console.log("=======================================================\n");

  if (!rutaExcel || !fs.existsSync(rutaExcel)) {
    console.log("⚠️  No se encontró ningún archivo Excel automáticamente.");
    console.log("📁 Coloca tu archivo en:");
    console.log("    -> migracion/usuarios.xlsx");
    console.log("    -> ./usuarios.xlsx");
    console.log("\nO ejecútalo pasando la ruta exacta:");
    console.log('   npm run actualizar-excel "C:/ruta/a/tu/archivo.xlsx" [--dry-run]\n');
    process.exit(1);
  }

  console.log(`📄 Archivo detectado: ${rutaExcel}`);
  console.log(`⚙️  Modo: ${esDryRun ? "🔍 DRY-RUN (Solo análisis / simulación)" : "⚡ IMPORTACIÓN Y ACTUALIZACIÓN REAL"}`);
  console.log("🛡️  Protección activa: La latitud y longitud existentes NUNCA se modifican.\n");

  console.log("⏳ Leyendo y cruzando datos con PostgreSQL...");
  const inicio = Date.now();

  try {
    const resultado = await procesarExcelUsuarios({
      rutaArchivo: rutaExcel,
      esDryRun,
    });

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log("\n=======================================================");
    console.log("📋 COLUMNAS DETECTADAS");
    console.log("=======================================================");
    for (const [campo, columna] of Object.entries(resultado.columnasMapeadas)) {
      if (columna) {
        console.log(`   ✓ ${campo.padEnd(16)} ➔ "${columna}"`);
      } else {
        console.log(`   — ${campo.padEnd(16)} (No presente)`);
      }
    }

    if (resultado.tarifasCreadas.length > 0) {
      console.log(`\n⚡ Tarifas nuevas creadas: ${resultado.tarifasCreadas.join(", ")}`);
    }
    if (resultado.estadosCreados.length > 0) {
      console.log(`\n📌 Estados nuevos creados: ${resultado.estadosCreados.join(", ")}`);
    }

    console.log("\n=======================================================");
    console.log("📈 RESULTADO FINAL");
    console.log("=======================================================");
    console.log(`Total filas en el archivo:             ${resultado.totalFilas.toLocaleString()}`);
    console.log(`Usuarios únicos en el archivo:         ${resultado.usuariosLeidos.toLocaleString()}`);
    console.log(`Usuarios encontrados en BD:           ${resultado.usuariosEncontrados.toLocaleString()}`);
    console.log(`  ├─ 🔄 Con cambios modificados:       ${resultado.usuariosModificados.toLocaleString()}`);
    console.log(`  └─ ⏸️  Sin cambios (datos idénticos): ${resultado.usuariosSinCambios.toLocaleString()}`);
    console.log(`✨ Nuevos usuarios registrados:        ${resultado.usuariosCreados.toLocaleString()}`);
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
      console.log(`   npm run actualizar-excel "${rutaExcel}"\n`);
    } else {
      console.log("\n🎉 ¡Sincronización finalizada con éxito en PostgreSQL!\n");
    }
  } catch (error: any) {
    console.error("\n❌ Error en migración:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
