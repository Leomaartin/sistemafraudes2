import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

// ==========================================
// CONFIGURACIÓN Y MAPEOS
// ==========================================

// Mapeo inicial de estados conocidos (ids según tu base de datos actual)
const ESTADOS_NORMALES_NOMBRES = [
  "NOTIFICADO",
  "SUSPENDIDO",
  "FRAUDE",
  "RECONECTADO",
  "RECONECTADO / FRAUDE",
  "RETIRADO",
  "RETIRADO / FRAUDE",
  "BAJA",
  "BAJA / FRAUDE",
  "PAGOS A CUENTA",
  "PAGOS A CUENTA / FRAUDE",
  "TIEMPO",
  "GERENCIA",
];

const ESTADOS_DEPTO_NOMBRES = [
  "SIN LLAVE",
  "CON LLAVE / FACTURACION",
  "NO TENEMOS LLAVE",
  "PORTERO/ADMINISTRACION",
];

interface FilaExcel {
  [key: string]: any;
}

function limpiarTexto(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function normalizarClave(val: string): string {
  return val
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Quitar tildes para macheo flexible
}

function esVerdadero(val: any): boolean {
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return ["SI", "S", "YES", "Y", "1", "TRUE", "X", "DEPTO", "EDIFICIO"].includes(str);
}

// ==========================================
// FUNCIÓN PRINCIPAL DE MIGRACIÓN
// ==========================================

async function migrar() {
  const args = process.argv.slice(2);
  const esDryRun = args.includes("--dry-run");
  const sobrescribir = args.includes("--update");

  // Buscar ruta del archivo Excel
  let rutaExcel = args.find((a) => !a.startsWith("--"));

  if (!rutaExcel) {
    const rutasPosibles = [
      path.join(process.cwd(), "migracion", "usuarios.xlsx"),
      path.join(process.cwd(), "usuarios.xlsx"),
      path.join(process.cwd(), "migracion", "usuarios.xls"),
      path.join(process.cwd(), "usuarios.xls"),
      path.join(process.cwd(), "migracion", "usuarios.csv"),
      path.join(process.cwd(), "usuarios.csv"),
    ];

    for (const r of rutasPosibles) {
      if (fs.existsSync(r)) {
        rutaExcel = r;
        break;
      }
    }
  }

  console.log("\n=======================================================");
  console.log("🚀 SISTEMA DE MIGRACIÓN EXCEL -> POSTGRESQL (PRISMA)");
  console.log("=======================================================\n");

  if (!rutaExcel || !fs.existsSync(rutaExcel)) {
    console.log("⚠️  No se encontró ningún archivo Excel automáticamente.");
    console.log("📁 Por favor coloca tu archivo en:");
    console.log("    -> migracion/usuarios.xlsx");
    console.log("   o en la raíz del proyecto:");
    console.log("    -> ./usuarios.xlsx");
    console.log("\nO ejecútalo pasando la ruta exacta:");
    console.log("   npx tsx scripts/migrarExcel.ts \"C:/ruta/a/tu/archivo.xlsx\" [--dry-run]\n");
    process.exit(0);
  }

  console.log(`📄 Archivo detectado: ${rutaExcel}`);
  console.log(`⚙️  Modo: ${esDryRun ? "🔍 DRY-RUN (Solo análisis, no escribe en BD)" : "⚡ IMPORTACIÓN REAL"}`);
  if (sobrescribir) console.log("🔄 Opción --update activa: actualizará datos si el usuario ya existe.");

  // 1. Leer el Excel
  console.log("\n⏳ Leyendo archivo Excel...");
  const workbook = XLSX.readFile(rutaExcel);
  const primeraHoja = workbook.SheetNames[0];
  const hoja = workbook.Sheets[primeraHoja];
  const filas: FilaExcel[] = XLSX.utils.sheet_to_json(hoja, { raw: false, defval: "" });

  console.log(`✅ Hoja leída: "${primeraHoja}" con ${filas.length.toLocaleString()} filas.`);

  if (filas.length === 0) {
    console.log("❌ El archivo está vacío.");
    process.exit(1);
  }

  // Detectar nombres de columnas de la primera fila
  const sample = filas[0];
  const columnasDisponibles = Object.keys(sample);
  console.log("📋 Columnas encontradas en el Excel:", columnasDisponibles);

  // Mapeador flexible de columnas
  const mapearColumna = (posibles: string[]): string | undefined => {
    return columnasDisponibles.find((col) =>
      posibles.includes(normalizarClave(col))
    );
  };

  const colUsuario = mapearColumna(["USUARIO", "NRO USUARIO", "NRO_USUARIO", "NUMERO", "CUENTA", "ID"]);
  const colNombre = mapearColumna(["NOMBRE", "NOMBRE Y APELLIDO", "TITULAR", "RAZON SOCIAL", "CLIENTE"]);
  const colDomicilio = mapearColumna(["DOMICILIO", "DIRECCION", "CALLE"]);
  const colTarifa = mapearColumna(["TARIFA", "COD_TARIFA", "TARIFA_ID"]);
  const colMedidor = mapearColumna(["MEDIDOR", "NRO_MEDIDOR", "MEDIDOR_NRO"]);
  const colRuta = mapearColumna(["RUTA", "NRO_RUTA", "RECORRIDO"]);
  const colObs = mapearColumna(["OBSERVACION", "OBSERVACIONES", "OBS"]);
  const colEstado = mapearColumna(["ESTADO", "ESTADO_USUARIO", "SITUACION"]);
  const colEdificio = mapearColumna(["EDIFICIO", "DEPTO", "DEPARTAMENTO", "ES_EDIFICIO"]);

  console.log("\n🔎 Mapeo de columnas detectado:");
  console.log(`   - Usuario:       ${colUsuario ?? "⚠️ NO ENCONTRADA"}`);
  console.log(`   - Nombre:        ${colNombre ?? "⚠️ NO ENCONTRADA"}`);
  console.log(`   - Domicilio:     ${colDomicilio ?? "(opcional)"}`);
  console.log(`   - Tarifa:        ${colTarifa ?? "(opcional)"}`);
  console.log(`   - Medidor:       ${colMedidor ?? "(opcional)"}`);
  console.log(`   - Ruta:          ${colRuta ?? "(opcional)"}`);
  console.log(`   - Observación:   ${colObs ?? "(opcional)"}`);
  console.log(`   - Estado:        ${colEstado ?? "(opcional)"}`);
  console.log(`   - Edificio:      ${colEdificio ?? "(opcional)"}`);

  if (!colUsuario || !colNombre) {
    console.error("\n❌ Error: Las columnas USUARIO y NOMBRE son obligatorias para continuar.");
    process.exit(1);
  }

  // 2. Cargar Estados existentes en la base de datos
  const estadosEnDb = await prisma.estado.findMany();
  const mapaEstadosPorNombre = new Map<string, { id: number; nombre: string }>();
  for (const est of estadosEnDb) {
    mapaEstadosPorNombre.set(normalizarClave(est.nombre), est);
  }

  // 3. Cargar Tarifas existentes en la base de datos
  const tarifasEnDb = await prisma.tarifa.findMany();
  const mapaTarifasPorNombre = new Map<string, { id: number; nombre: string }>();
  for (const t of tarifasEnDb) {
    mapaTarifasPorNombre.set(normalizarClave(t.nombre), t);
  }

  // Conjuntos para análisis previo
  const tarifasEncontradas = new Set<string>();
  const estadosEncontrados = new Set<string>();
  const valoresEdificio = new Map<string, number>();
  const usuariosVistos = new Set<string>();
  const usuariosDuplicados = new Set<string>();
  let filasVacias = 0;

  for (const f of filas) {
    const rawUser = limpiarTexto(f[colUsuario]);
    if (!rawUser) {
      filasVacias++;
      continue;
    }

    if (usuariosVistos.has(rawUser)) {
      usuariosDuplicados.add(rawUser);
    } else {
      usuariosVistos.add(rawUser);
    }

    if (colTarifa && f[colTarifa]) {
      const t = limpiarTexto(f[colTarifa]);
      if (t) tarifasEncontradas.add(t);
    }

    if (colEstado && f[colEstado]) {
      const e = limpiarTexto(f[colEstado]);
      if (e) estadosEncontrados.add(e);
    }

    if (colEdificio && f[colEdificio] !== undefined) {
      const edVal = limpiarTexto(f[colEdificio]);
      valoresEdificio.set(edVal, (valoresEdificio.get(edVal) || 0) + 1);
    }
  }

  console.log("\n=======================================================");
  console.log("📊 RESUMEN DEL ANÁLISIS DEL EXCEL");
  console.log("=======================================================");
  console.log(`Total filas en archivo:       ${filas.length.toLocaleString()}`);
  console.log(`Usuarios únicos identificados: ${usuariosVistos.size.toLocaleString()}`);
  console.log(`Filas duplicadas de usuario:  ${usuariosDuplicados.size.toLocaleString()}`);
  console.log(`Filas vacías / sin usuario:   ${filasVacias}`);

  console.log(`\n🏢 Valores detectados en la columna "${colEdificio}":`);
  for (const [val, cant] of valoresEdificio.entries()) {
    const interpretacion = esVerdadero(val) ? "-> esDepartamento = TRUE" : "-> esDepartamento = FALSE";
    console.log(`   - "${val}": ${cant.toLocaleString()} filas (${interpretacion})`);
  }

  console.log(`\n🏷️ Tarifas distintas encontradas (${tarifasEncontradas.size}):`);
  const tarifasNuevas: string[] = [];
  for (const t of tarifasEncontradas) {
    const yaExiste = mapaTarifasPorNombre.has(normalizarClave(t));
    if (!yaExiste) tarifasNuevas.push(t);
  }
  console.log(`   - Ya existentes en BD: ${tarifasEncontradas.size - tarifasNuevas.length}`);
  console.log(`   - Nuevas a crear:      ${tarifasNuevas.length}`);
  if (tarifasNuevas.length > 0) {
    console.log("   Nuevas:", tarifasNuevas.slice(0, 15).join(", "), tarifasNuevas.length > 15 ? "..." : "");
  }

  console.log(`\n📌 Estados distintos encontrados (${estadosEncontrados.size}):`);
  const estadosNuevos: string[] = [];
  for (const e of estadosEncontrados) {
    const yaExiste = mapaEstadosPorNombre.has(normalizarClave(e));
    if (!yaExiste) estadosNuevos.push(e);
  }
  console.log(`   - Coincidentes con BD:  ${estadosEncontrados.size - estadosNuevos.length}`);
  if (estadosNuevos.length > 0) {
    console.log(`   - No reconocidos / nuevos (${estadosNuevos.length}):`, estadosNuevos.join(", "));
  }

  if (esDryRun) {
    console.log("\n🔍 Fin del modo DRY-RUN. No se realizaron cambios en la base de datos.");
    console.log("💡 Para ejecutar la importación real, ejecuta:");
    console.log(`   npx tsx scripts/migrarExcel.ts "${rutaExcel}"\n`);
    process.exit(0);
  }

  // ==========================================
  // INSERCIÓN REAL EN BASE DE DATOS
  // ==========================================

  // 1. Crear tarifas faltantes
  if (tarifasNuevas.length > 0) {
    console.log(`\n✨ Creando ${tarifasNuevas.length} tarifas nuevas en base de datos...`);
    for (const t of tarifasNuevas) {
      const creada = await prisma.tarifa.create({
        data: { nombre: t },
      });
      mapaTarifasPorNombre.set(normalizarClave(t), creada);
    }
    console.log("✅ Tarifas sincronizadas.");
  }

  // 2. Crear estados faltantes si hubiera
  if (estadosNuevos.length > 0) {
    console.log(`\n✨ Registrando ${estadosNuevos.length} estados nuevos en base de datos...`);
    for (const e of estadosNuevos) {
      const creado = await prisma.estado.create({
        data: { nombre: e },
      });
      mapaEstadosPorNombre.set(normalizarClave(e), creado);
    }
    console.log("✅ Estados sincronizados.");
  }

  // 3. Preparar usuarios para inserción por lotes
  console.log("\n📦 Procesando y transformando filas de usuarios...");

  const usuariosParaInsertar: any[] = [];
  const usuariosProcesadosSet = new Set<string>();

  for (const fila of filas) {
    const nroUsuario = limpiarTexto(fila[colUsuario]);
    if (!nroUsuario) continue;

    // Evitar insertar duplicados dentro del mismo archivo Excel (se toma la primera aparición)
    if (usuariosProcesadosSet.has(nroUsuario)) {
      continue;
    }
    usuariosProcesadosSet.add(nroUsuario);

    const nombre = limpiarTexto(fila[colNombre]);
    const domicilio = colDomicilio ? limpiarTexto(fila[colDomicilio]) || null : null;
    const medidor = colMedidor ? limpiarTexto(fila[colMedidor]) || null : null;
    const ruta = colRuta ? limpiarTexto(fila[colRuta]) || null : null;
    const observaciones = colObs ? limpiarTexto(fila[colObs]) || null : null;

    // Determinación de Edificio / Departamento
    const valorEdificioRaw = colEdificio ? fila[colEdificio] : null;
    const esDepto = esVerdadero(valorEdificioRaw);

    // Asociación de Tarifa
    let idTarifa: number | null = null;
    if (colTarifa && fila[colTarifa]) {
      const tarNombre = limpiarTexto(fila[colTarifa]);
      const tarObj = mapaTarifasPorNombre.get(normalizarClave(tarNombre));
      if (tarObj) idTarifa = tarObj.id;
    }

    // Asociación de Estado
    let idEstado: number | null = null;
    let idEstadoDepto: number | null = null;

    if (colEstado && fila[colEstado]) {
      const estNombre = limpiarTexto(fila[colEstado]);
      const estObj = mapaEstadosPorNombre.get(normalizarClave(estNombre));
      if (estObj) {
        // Verificar si el estado es de departamento o normal
        const esEstadoDeDepto = ESTADOS_DEPTO_NOMBRES.some(
          (nom) => normalizarClave(nom) === normalizarClave(estObj.nombre)
        );

        if (esDepto) {
          if (esEstadoDeDepto) {
            idEstadoDepto = estObj.id;
          } else {
            // El usuario es depto pero tiene un estado normal (ej: NOTIFICADO)
            idEstado = estObj.id;
          }
        } else {
          idEstado = estObj.id;
        }
      }
    }

    usuariosParaInsertar.push({
      nroUsuario,
      nombre,
      domicilio,
      medidor,
      ruta,
      observaciones,
      esDepartamento: esDepto,
      idTarifa,
      idEstado,
      idEstadoDepto,
    });
  }

  console.log(`📋 Total de usuarios listos para insertar: ${usuariosParaInsertar.length.toLocaleString()}`);

  // Inserción en bloques (chunks) de 500 para máxima velocidad y eficiencia
  const CHUNK_SIZE = 500;
  let insertados = 0;
  let errores = 0;

  console.log(`\n⚡ Insertando usuarios en PostgreSQL en bloques de ${CHUNK_SIZE}...`);

  for (let i = 0; i < usuariosParaInsertar.length; i += CHUNK_SIZE) {
    const chunk = usuariosParaInsertar.slice(i, i + CHUNK_SIZE);
    try {
      const res = await prisma.usuario.createMany({
        data: chunk,
        skipDuplicates: true, // Si el nroUsuario ya existe en la BD, no se cae la migración
      });
      insertados += res.count;
      process.stdout.write(`   ➡️  Procesados: ${Math.min(i + CHUNK_SIZE, usuariosParaInsertar.length)} / ${usuariosParaInsertar.length} (Insertados: ${insertados})\r`);
    } catch (err: any) {
      console.error(`\n❌ Error al insertar bloque ${i} a ${i + CHUNK_SIZE}:`, err.message);
      errores += chunk.length;
    }
  }

  console.log("\n\n=======================================================");
  console.log("🏁 MIGRACIÓN COMPLETADA");
  console.log("=======================================================");
  console.log(`✅ Usuarios nuevos insertados: ${insertados.toLocaleString()}`);
  if (usuariosParaInsertar.length - insertados > 0) {
    console.log(`ℹ️  Usuarios omitidos (ya existían en la base): ${(usuariosParaInsertar.length - insertados).toLocaleString()}`);
  }
  const totalEnBd = await prisma.usuario.count();
  console.log(`📊 Total actual de usuarios en la base de datos: ${totalEnBd.toLocaleString()}`);
  console.log("=======================================================\n");
}

migrar()
  .catch((e) => {
    console.error("❌ Error fatal en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
