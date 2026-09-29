import { prisma } from "../lib/prisma";

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

  console.log(`TOTAL_SIN_COORDS=${sinCoords.length}`);

  // Let's create smart grouping
  // If starts with E.SMITHFIELD -> E.SMITHFIELD
  // If starts with B. (barrio) -> Barrio name
  // If has street name -> Street name
  const grupos: Record<string, number> = {};

  for (const u of sinCoords) {
    let d = (u.domicilio || "").trim().toUpperCase();
    if (!d) {
      grupos["(SIN DOMICILIO)"] = (grupos["(SIN DOMICILIO)"] || 0) + 1;
      continue;
    }

    // Clean common encoding issue ﾑ -> Ñ
    d = d.replace(/ﾑ/g, "Ñ");

    let key = "";
    if (d.includes("SMITHFIELD") || d.startsWith("E.SMITH") || d.startsWith("E. SMITH")) {
      key = "E.SMITHFIELD";
    } else if (d.startsWith("FINCAS DE LA FLORIDA") || d.includes("FLORIDA")) {
      key = "FINCAS DE LA FLORIDA";
    } else if (d.startsWith("LOS CAMPOS DE FRESNOS") || d.includes("FRESNOS")) {
      key = "CAMPOS DE FRESNOS";
    } else if (d.startsWith("CANAL MARTIN IRIGOYEN")) {
      key = "CANAL MARTIN IRIGOYEN";
    } else if (d.startsWith("RINCON DEL SAUCE")) {
      key = "RINCON DEL SAUCE";
    } else if (d.startsWith("EL CASAL") || d.includes("CASAL")) {
      key = "EL CASAL";
    } else if (d.startsWith("EL BOSQUE") || d.includes("EL BOSQUE")) {
      key = "EL BOSQUE";
    } else if (d.startsWith("CHACRAS DE LA CRUZ")) {
      key = "CHACRAS DE LA CRUZ";
    } else if (d.startsWith("B.") || d.startsWith("BO ") || d.startsWith("BARRIO ")) {
      // Barrio
      const bMatch = d.match(/^(B\.|BO\s+|BARRIO\s+)([A-Z\s\.\'\-]+?)(?:\s+(?:C\.|CASA|M\.|MZ|L\.|LOTE|S\/N|\d).*|$)/);
      if (bMatch) {
        key = `BARRIO ${bMatch[2].trim()}`;
      } else {
        key = d.split(/\s+(?:C\.|L\.|M\.)/)[0].trim();
      }
    } else if (d.startsWith("COVEPAN") || d.includes("COVEPAN")) {
      const cMatch = d.match(/(COVEPAN\s+[IVXLCDM]+)/);
      key = cMatch ? cMatch[1] : "COVEPAN";
    } else if (d.startsWith("PROCASA")) {
      const pMatch = d.match(/(PROCASA\s+[IVXLCDM]+)/);
      key = pMatch ? pMatch[1] : "PROCASA";
    } else if (d.startsWith("MONOB") || d.startsWith("CONSORC")) {
      key = "MONOBLOCKS / CONSORCIOS";
    } else {
      // Extract street name
      // e.g. "BERUTTI 2062" -> "BERUTTI"
      // "SGTO.CABRAL 397" -> "SGTO.CABRAL"
      // "SAENZ PEÑA 377" -> "SAENZ PEÑA"
      // "9 DE JULIO 136 3 A" -> "9 DE JULIO"
      // "J.J.PASSO 1044" -> "J.J.PASSO"
      let clean = d
        .replace(/\b(PISO|P\.?|DEPTO|DTO|DPTO|PB|LOCAL|CASA|MANZANA|MZ|LOTE|LT|QUINTA|QTA|CHACRA|CH)\b.*$/i, "")
        .replace(/[,\-\/].*$/, "")
        .trim();

      // Check number match
      const m = clean.match(/^([A-Za-z\s\.\'\-]+?)\s+(\d+)/);
      if (m) {
        key = m[1].trim();
      } else {
        key = clean;
      }
    }

    // Clean leading/trailing colon or dots
    key = key.replace(/^[:\s\.\-]+/, "").trim();
    grupos[key] = (grupos[key] || 0) + 1;
  }

  const sorted = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted) {
    console.log(`${k} = ${v}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
