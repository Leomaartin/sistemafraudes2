import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";
import path from "path";

async function main() {
  console.log("⏳ Obteniendo los usuarios sin estado asignado (idEstado: null)...");

  const usuarios = await prisma.usuario.findMany({
    where: { idEstado: null },
    include: {
      tarifa: true,
      cuadrillas: true,
      estadoDepto: true,
    },
    orderBy: { id: "asc" },
  });

  const total = usuarios.length;
  console.log(`Total usuarios sin estado: ${total}`);

  // Mapeador de filas
  const mapearFila = (u: typeof usuarios[0]) => ({
    "ID": u.id,
    "NRO USUARIO": u.nroUsuario,
    "NOMBRE": u.nombre,
    "DOMICILIO": u.domicilio || "",
    "RUTA": u.ruta || "",
    "MEDIDOR": u.medidor || "",
    "TARIFA": u.tarifa?.nombre || "",
    "OBSERVACIONES": u.observaciones || "(VACÍO / SIN OBSERVACIONES)",
    "DEPARTAMENTO": u.esDepartamento ? "SÍ" : "NO",
    "ESTADO DEPTO": u.estadoDepto?.nombre || "",
    "CUADRILLAS": u.cuadrillas.map((c) => c.nombre).join(" / "),
    "FECHA VTO": u.fechaVto ? u.fechaVto.toISOString().split("T")[0] : "",
    "LATITUD": u.latitud ?? "",
    "LONGITUD": u.longitud ?? "",
    "TIENE GEO": u.latitud && u.longitud ? "SÍ" : "NO",
  });

  // 1. Todos los usuarios sin estado (1.695)
  const filasTodosSinEstado = usuarios.map(mapearFila);

  // 2. Solo los que tienen observaciones vacías (1.344)
  const filasSinObservaciones = usuarios
    .filter((u) => !u.observaciones || !u.observaciones.trim())
    .map(mapearFila);

  // 3. Los que tienen notas técnicas varias (351)
  const filasConNotasTecnicas = usuarios
    .filter((u) => u.observaciones && u.observaciones.trim().length > 0)
    .map(mapearFila);

  const workbook = XLSX.utils.book_new();

  const wsTodos = XLSX.utils.json_to_sheet(filasTodosSinEstado);
  XLSX.utils.book_append_sheet(workbook, wsTodos, "Todos Sin Estado (1695)");

  const wsSinObs = XLSX.utils.json_to_sheet(filasSinObservaciones);
  XLSX.utils.book_append_sheet(workbook, wsSinObs, "Sin Observaciones (1344)");

  const wsConNotas = XLSX.utils.json_to_sheet(filasConNotasTecnicas);
  XLSX.utils.book_append_sheet(workbook, wsConNotas, "Con Notas Técnicas (351)");

  const cols = [
    { wch: 8 },  // ID
    { wch: 14 }, // NRO USUARIO
    { wch: 32 }, // NOMBRE
    { wch: 35 }, // DOMICILIO
    { wch: 8 },  // RUTA
    { wch: 18 }, // MEDIDOR
    { wch: 14 }, // TARIFA
    { wch: 45 }, // OBSERVACIONES
    { wch: 14 }, // DEPARTAMENTO
    { wch: 22 }, // ESTADO DEPTO
    { wch: 20 }, // CUADRILLAS
    { wch: 12 }, // FECHA VTO
    { wch: 12 }, // LATITUD
    { wch: 12 }, // LONGITUD
    { wch: 10 }, // TIENE GEO
  ];

  wsTodos["!cols"] = cols;
  wsSinObs["!cols"] = cols;
  wsConNotas["!cols"] = cols;

  const rutaDestino = path.join(process.cwd(), "usuarios_sin_estado.xlsx");
  XLSX.writeFile(workbook, rutaDestino);

  console.log(`\n✅ Archivo Excel generado en:`);
  console.log(`   👉 ${rutaDestino}`);
  console.log(`   - Solapa 1: "Todos Sin Estado" (${filasTodosSinEstado.length} filas)`);
  console.log(`   - Solapa 2: "Sin Observaciones" (${filasSinObservaciones.length} filas)`);
  console.log(`   - Solapa 3: "Con Notas Técnicas" (${filasConNotasTecnicas.length} filas)\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
