import { prisma } from "../lib/prisma";
import fs from "fs";

async function main() {
  const sinCoords = await prisma.usuario.findMany({
    where: {
      OR: [
        { latitud: null },
        { longitud: null }
      ]
    },
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
    }
  });

  const total = sinCoords.length;

  // Let's analyze how to cleanly group them by Street / Barrio / Category
  // We want to normalize names:
  // e.g., "E.SMITHFIELD", "BERUTTI", "ARRIBEÑOS", "ESPAÑA", "SAENZ PEÑA", "SGTO.CABRAL", etc.

  function normalizeCalle(rawDom: string | null): string {
    if (!rawDom || !rawDom.trim()) return "(SIN DOMICILIO)";
    let d = rawDom.trim().toUpperCase();

    // Fix encoding
    d = d.replace(/ﾑ/g, "Ñ").replace(/#/g, "Ñ").replace(/･/g, "Ñ");

    // Barrio Smithfield / Estación Smithfield
    if (/SMITHFIELD/i.test(d)) return "E.SMITHFIELD";

    // Fincas de la Florida
    if (/FINCAS?\s+DE\s+LA\s+FLORIDA/i.test(d) || /FLORIDA/i.test(d)) return "FINCAS DE LA FLORIDA";

    // Las Marías / L. Marías
    if (/LAS\s+MARIAS|L\.?\s*MAR[IÍ]A/i.test(d)) return "BARRIO LAS MARIAS";

    // Vipermún
    if (/VIPERMUN/i.test(d)) return "BARRIO VIPERMUN";

    // Covepan
    if (/COVEPAN/i.test(d)) return "BARRIO COVEPAN";

    // UOM
    if (/\bUOM\b/i.test(d)) return "BARRIO UOM";

    // Fonavi
    if (/FONAVI/i.test(d)) return "BARRIO FONAVI";

    // Procasa
    if (/PROCASA/i.test(d)) return "BARRIO PROCASA";

    // Instituto de la Vivienda
    if (/INS(T)?\.?\s*VIVIENDA/i.test(d)) return "BARRIO INST. VIVIENDA";

    // Plan Federal
    if (/PLAN\s+FED(ERAL)?/i.test(d)) return "BARRIO PLAN FEDERAL";

    // Escalada
    if (/ESCALADA/i.test(d)) return "B. ESCALADA";

    // La Carona
    if (/LA\s+CARONA/i.test(d)) return "B. LA CARONA";

    // Campos de Fresnos
    if (/FRESNOS/i.test(d)) return "CAMPOS DE FRESNOS";

    // Canal Martin Irigoyen
    if (/CANAL\s+MARTIN\s+IRIGOYEN/i.test(d)) return "CANAL MARTIN IRIGOYEN";

    // El Casal
    if (/EL\s+CASAL/i.test(d)) return "EL CASAL";

    // El Bosque
    if (/EL\s+BOSQUE/i.test(d)) return "EL BOSQUE";

    // Rincon del Sauce
    if (/RINCON\s+DEL\s+SAUCE/i.test(d)) return "RINCON DEL SAUCE";

    // R. Peña / Roque Saenz Peña / Saenz Peña
    if (/(?:R\.?\s*PEÑA|ROQUE\s+PEÑA)/i.test(d)) return "ROQUE PEÑA";
    if (/(?:SAENZ\s+PEÑA|S\.?\s*PEÑA)/i.test(d)) return "SAENZ PEÑA";

    // Berutti / Beruti
    if (/BERUT+I/i.test(d)) return "BERUTI / BERUTTI";

    // Arribeños
    if (/AR+IBE[ÑN]OS/i.test(d)) return "ARRIBEÑOS";

    // España
    if (/ESPA[ÑN]A/i.test(d)) return "ESPAÑA";

    // Sargento Cabral / Sgto Cabral
    if (/S(?:G)?TO\.?\s*CABRAL/i.test(d)) return "SGTO. CABRAL";

    // J.J. Paso / Passo
    if (/PAS+O/i.test(d)) return "J.J. PASO";

    // Independencia
    if (/INDEPEND/i.test(d)) return "INDEPENDENCIA";

    // Ameghino
    if (/AMEGHINO/i.test(d)) return "AMEGHINO";

    // 9 de Julio
    if (/9\s+DE\s+JULIO/i.test(d)) return "9 DE JULIO";

    // 25 de Mayo
    if (/25\s+DE\s+MAYO/i.test(d)) return "25 DE MAYO";

    // 3 de Febrero
    if (/3\s+DE\s+FEBRERO/i.test(d)) return "3 DE FEBRERO";

    // 1 de Mayo
    if (/1\s+DE\s+MAYO/i.test(d)) return "1 DE MAYO";

    // 11 de Noviembre
    if (/11\s+DE\s+NOVIEMBRE/i.test(d)) return "11 DE NOVIEMBRE";

    // Rómulo Noya
    if (/R(?:OMULO|\.)?\s*NOYA/i.test(d)) return "ROMULO NOYA";

    // General Paz / Gral Paz
    if (/G(?:RAL)?\.?\s*PAZ/i.test(d)) return "GENERAL PAZ";

    // H. Yrigoyen / Irigoyen
    if (/(?:H\.?\s*)?(?:YRIGOYEN|IRIGOYEN)/i.test(d)) return "HIPOLITO YRIGOYEN";

    // B. Mitre / Bartolomé Mitre
    if (/(?:B\.?\s*)?MITRE/i.test(d)) return "BARTOLOME MITRE";

    // Ituzaingo
    if (/ITUZAINGO/i.test(d)) return "ITUZAINGO";

    // A. del Valle / Aristobulo del Valle
    if (/A(?:RISTOBULO|\.)?\s*DEL\s*VALLE/i.test(d)) return "A. DEL VALLE";

    // Camino / Cno
    if (/CNO|CAMINO/i.test(d)) {
      return d.replace(/\s+(?:S\/N|\d+).*$/, "").trim();
    }

    // Default: try street name before numbers
    let limpio = d
      .replace(/\b(PISO|P\.?|DEPTO|DTO|DPTO|PB|LOCAL|CASA|MANZANA|MZ|LOTE|LT|QUINTA|QTA|CHACRA|CH)\b.*$/i, "")
      .replace(/[,\-\/].*$/, "")
      .trim();

    const m = limpio.match(/^([A-Za-z\s\.\'\-]+?)\s+(\d+)/);
    if (m) {
      return m[1].replace(/^[:\s\.\-]+/, "").trim();
    }

    return limpio.replace(/^[:\s\.\-]+/, "").trim();
  }

  const agrupados: Record<string, number> = {};
  const detallePorGrupo: Record<string, string[]> = {};

  for (const u of sinCoords) {
    const calle = normalizeCalle(u.domicilio);
    agrupados[calle] = (agrupados[calle] || 0) + 1;
    if (!detallePorGrupo[calle]) detallePorGrupo[calle] = [];
    if (detallePorGrupo[calle].length < 10) {
      detallePorGrupo[calle].push(u.domicilio || "(VACIO)");
    }
  }

  const sorted = Object.entries(agrupados).sort((a, b) => b[1] - a[1]);

  const output = {
    total,
    totalGrupos: sorted.length,
    agrupados: sorted.map(([k, v]) => ({ nombre: k, cantidad: v, ejemplos: detallePorGrupo[k] }))
  };

  fs.writeFileSync("scripts/resumen_fallidos.json", JSON.stringify(output, null, 2), "utf-8");
  console.log("GUARDADO EXITOSO");
  console.log(`TOTAL SIN COORDENADAS: ${total}`);
  for (const item of sorted) {
    console.log(`${item[0]} = ${item[1]}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
