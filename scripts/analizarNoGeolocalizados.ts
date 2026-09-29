import { prisma } from "../lib/prisma";

async function main() {
  console.log("========================================================");
  console.log("🔍 ANÁLISIS DE USUARIOS NO LOCALIZADOS EN MAPS (ZÁRATE)");
  console.log("========================================================\n");

  const totalUsuarios = await prisma.usuario.count();
  const conGeo = await prisma.usuario.count({
    where: {
      latitud: { not: null },
      longitud: { not: null },
    },
  });

  const sinGeo = await prisma.usuario.findMany({
    where: {
      OR: [{ latitud: null }, { longitud: null }],
    },
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      ruta: true,
      estado: {
        select: {
          nombre: true,
        },
      },
    },
  });

  console.log(`📊 Total usuarios en padrón:   ${totalUsuarios.toLocaleString()}`);
  console.log(`✅ Con coordenadas en Maps:    ${conGeo.toLocaleString()} (${((conGeo / totalUsuarios) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Sin coordenadas (pendientes): ${sinGeo.length.toLocaleString()} (${((sinGeo.length / totalUsuarios) * 100).toFixed(1)}%)\n`);

  // Agrupamiento por Calle base limpia
  const mapaCalles: Record<string, { total: number; conFraude: number; ejemplos: string[] }> = {};
  const categorias: Record<string, number> = {
    "Barrios / Planes de Vivienda / Lotes (ej. B°, PROCASA, COVIZPO)": 0,
    "Calles con abreviatura especial (ej. SGTO. CABRAL, F.PAGOLA, PJE)": 0,
    "Sin numeración / S/N / Esquinas": 0,
    "Dirección vacía o demasiado corta": 0,
    "Calles normales pero número no encontrado en Nominatim": 0,
  };

  for (const u of sinGeo) {
    const rawDom = (u.domicilio || "").trim().toUpperCase();
    const esFraude = u.estado?.nombre?.toUpperCase().includes("FRAUDE") || false;

    if (!rawDom || rawDom.length < 3) {
      categorias["Dirección vacía o demasiado corta"]++;
      continue;
    }

    if (
      rawDom.includes("B°") ||
      rawDom.includes("BARRIO") ||
      rawDom.includes("BO ") ||
      rawDom.includes("PROCASA") ||
      rawDom.includes("PLAN ") ||
      rawDom.includes("COVIZPO") ||
      rawDom.includes("VILLA ") ||
      rawDom.includes("FONAVI") ||
      rawDom.includes("UOCRA") ||
      rawDom.includes("QTA")
    ) {
      categorias["Barrios / Planes de Vivienda / Lotes (ej. B°, PROCASA, COVIZPO)"]++;
    } else if (
      rawDom.startsWith("SGTO") ||
      rawDom.startsWith("SGT.") ||
      rawDom.startsWith("PJE") ||
      rawDom.startsWith("PASAJE") ||
      rawDom.startsWith("TTE") ||
      rawDom.startsWith("CNEL") ||
      rawDom.startsWith("DR.") ||
      rawDom.startsWith("CTADA")
    ) {
      categorias["Calles con abreviatura especial (ej. SGTO. CABRAL, F.PAGOLA, PJE)"]++;
    } else if (
      rawDom.includes("S/N") ||
      rawDom.includes("S / N") ||
      rawDom.includes("SIN N") ||
      rawDom.includes("ESQ") ||
      rawDom.includes(" Y ") ||
      !/\d+/.test(rawDom)
    ) {
      categorias["Sin numeración / S/N / Esquinas"]++;
    } else {
      categorias["Calles normales pero número no encontrado en Nominatim"]++;
    }

    // Extraer nombre aproximado de calle
    let calleBase = rawDom
      .replace(/\b(PISO|P\.?|DEPTO|DTO|DPTO|PB|PA|FONDO|LOCAL|CASA|MANZANA|MZ|LOTE|LT|BIS|C\.\d+|SEC\.\d+)\b.*$/i, "")
      .replace(/\s+\d+.*$/, "")
      .replace(/^[0-9\.\-\/]+\s+/, "")
      .trim();

    if (!calleBase) calleBase = rawDom;

    if (!mapaCalles[calleBase]) {
      mapaCalles[calleBase] = { total: 0, conFraude: 0, ejemplos: [] };
    }

    mapaCalles[calleBase].total++;
    if (esFraude) mapaCalles[calleBase].conFraude++;
    if (mapaCalles[calleBase].ejemplos.length < 3 && !mapaCalles[calleBase].ejemplos.includes(rawDom)) {
      mapaCalles[calleBase].ejemplos.push(rawDom);
    }
  }

  console.log("--------------------------------------------------------");
  console.log("📌 DESGLOSE POR TIPO DE PROBLEMA EN LA DIRECCIÓN");
  console.log("--------------------------------------------------------");
  for (const [cat, cant] of Object.entries(categorias)) {
    const pct = ((cant / sinGeo.length) * 100).toFixed(1);
    console.log(` • ${cat.padEnd(65)} : ${String(cant).padStart(5)} (${pct}%)`);
  }

  console.log("\n--------------------------------------------------------");
  console.log("🚨 TOP 35 CALLES / PATRONES CON MÁS CASOS NO LOCALIZADOS");
  console.log("--------------------------------------------------------");
  console.log(
    "Calle / Patrón Detectado".padEnd(32) +
      "Total Sin Geo".padStart(14) +
      "Con Fraude".padStart(13) +
      "  Ejemplos reales en BD"
  );
  console.log("-".repeat(100));

  const ranking = Object.entries(mapaCalles)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 35);

  for (const [calle, info] of ranking) {
    const calleStr = calle.length > 30 ? calle.slice(0, 27) + "..." : calle;
    const ejemplosStr = info.ejemplos.join(" | ");
    console.log(
      calleStr.padEnd(32) +
        String(info.total).padStart(14) +
        String(info.conFraude).padStart(13) +
        `  (${ejemplosStr})`
    );
  }

  console.log("\n========================================================");
  console.log("💡 OBSERVACIONES CLAVE PARA MEJORAR LA GEOLOCALIZACIÓN");
  console.log("========================================================");
  console.log("1. 'SGTO.CABRAL' / 'SARGENTO CABRAL': OpenStreetMap suele esperar 'Sargento Cabral'.");
  console.log("2. 'B° PLAN FEDERAL' / 'B.FONAVI' / 'COVIZPO': No son calles sino barrios con casas/manzanas.");
  console.log("3. 'PJE.' / 'PASAJE': Varios pasajes peatonales no tienen altura oficial en OSM.");
  console.log("4. 'PROCASA': Barrios sociales ('PROCASA I, II, III C.21') requieren mapeo al barrio de Zárate.");
  console.log("========================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
