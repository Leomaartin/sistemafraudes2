import { prisma } from "../lib/prisma";
import * as XLSX from "xlsx";
import path from "path";

async function main() {
  const sinCoords = await prisma.usuario.findMany({
    where: {
      OR: [
        { latitud: null },
        { longitud: null }
      ]
    },
    include: {
      estado: true,
      tarifa: true,
      cuadrillas: true,
    },
    orderBy: { id: "asc" }
  });

  console.log(`Total usuarios sin coordenadas: ${sinCoords.length}`);

  // Analizar razones
  let sinDomicilio = 0;
  let islaDelta = 0;
  let barrioCerradoLote = 0;
  let rutasCaminosRurales = 0;
  let callesSinNumero = 0;
  let otros = 0;

  const desgloseRutas: Record<string, number> = {};
  const desgloseEstados: Record<string, number> = {};

  const rowsExcel: any[] = [];

  for (const u of sinCoords) {
    const d = (u.domicilio || "").trim().toUpperCase();
    const r = u.ruta ? String(u.ruta).trim() : "SIN RUTA";
    const est = u.estado?.nombre || "SIN ESTADO";

    desgloseRutas[r] = (desgloseRutas[r] || 0) + 1;
    desgloseEstados[est] = (desgloseEstados[est] || 0) + 1;

    let categoria = "CALLE URBANA DIFÍCIL / SIN NÚMERO";
    if (!d || d === "-" || d === "S/D" || d === "SIN DOMICILIO") {
      sinDomicilio++;
      categoria = "SIN DOMICILIO REGISTRADO";
    } else if (
      d.includes("ISLA") || d.includes("RIO") || d.includes("ARROYO") || 
      d.includes("CANAL") || d.includes("PARANA") || d.includes("ALEM") ||
      d.includes("CARABELAS") || d.includes("TIGRES")
    ) {
      islaDelta++;
      categoria = "ZONA DE ISLAS / DELTA";
    } else if (
      d.includes("LOTE") || d.includes("LT") || d.includes("MZ") || 
      d.includes("MANZANA") || d.includes("CHACRA") || d.includes("GJA") || 
      d.includes("GRANJA") || d.includes("QUINTA")
    ) {
      barrioCerradoLote++;
      categoria = "LOTEOS / MANZANAS / CHACRAS";
    } else if (
      d.includes("RUTA") || d.includes("RTA") || d.includes("KM") || 
      d.includes("CNO") || d.includes("CAMINO")
    ) {
      rutasCaminosRurales++;
      categoria = "RUTAS / CAMINOS RURALES";
    } else if (d.includes("S/N") || !/\d/.test(d)) {
      callesSinNumero++;
      categoria = "CALLE SIN ALTURA (S/N)";
    } else {
      otros++;
    }

    rowsExcel.push({
      "ID": u.id,
      "N° USUARIO": u.nroUsuario,
      "TITULAR": u.nombre,
      "DOMICILIO": u.domicilio || "(Sin domicilio)",
      "CATEGORÍA DETECTADA": categoria,
      "RUTA": u.ruta || "S/R",
      "TARIFA": u.tarifa?.nombre || "S/T",
      "ESTADO": est,
      "OBSERVACIONES": u.observaciones || ""
    });
  }

  console.log("\nCategorías:");
  console.log(`- Sin domicilio: ${sinDomicilio}`);
  console.log(`- Zona de Islas / Delta: ${islaDelta}`);
  console.log(`- Loteos / Manzanas / Chacras: ${barrioCerradoLote}`);
  console.log(`- Rutas / Caminos rurales: ${rutasCaminosRurales}`);
  console.log(`- Calles urbanas sin altura (S/N): ${callesSinNumero}`);
  console.log(`- Calles con numeración no encontrada: ${otros}`);

  console.log("\nTop 10 Rutas con más casos sin geolocalizar:");
  const rutasSorted = Object.entries(desgloseRutas).sort((a, b) => b[1] - a[1]);
  rutasSorted.slice(0, 10).forEach(([r, cnt]) => console.log(`  Ruta ${r}: ${cnt}`));

  console.log("\nTop Estados de usuarios sin geolocalizar:");
  const estadosSorted = Object.entries(desgloseEstados).sort((a, b) => b[1] - a[1]);
  estadosSorted.forEach(([e, cnt]) => console.log(`  ${e}: ${cnt}`));

  // Crear Excel
  const ws = XLSX.utils.json_to_sheet(rowsExcel);
  ws["!cols"] = [
    { wch: 8 },  // ID
    { wch: 14 }, // N° USUARIO
    { wch: 30 }, // TITULAR
    { wch: 36 }, // DOMICILIO
    { wch: 30 }, // CATEGORÍA
    { wch: 10 }, // RUTA
    { wch: 12 }, // TARIFA
    { wch: 22 }, // ESTADO
    { wch: 45 }, // OBSERVACIONES
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sin Geolocalizacion");

  const outPath = path.join(process.cwd(), "informe_domicilios_sin_geolocalizar.xlsx");
  try {
    XLSX.writeFile(wb, outPath);
    console.log(`\nArchivo Excel creado: ${outPath}`);
  } catch (err: any) {
    if (err.code === "EBUSY") {
      const altPath = path.join(process.cwd(), "informe_domicilios_sin_geolocalizar_actualizado.xlsx");
      XLSX.writeFile(wb, altPath);
      console.log(`\nArchivo original abierto en Excel. Guardado como: ${altPath}`);
    } else {
      throw err;
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
