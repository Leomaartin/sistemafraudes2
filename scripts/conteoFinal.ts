import { prisma } from "../lib/prisma";
import fs from "fs";

async function main() {
  const sinCoords = await prisma.usuario.findMany({
    where: {
      OR: [{ latitud: null }, { longitud: null }],
    },
    select: {
      id: true,
      nroUsuario: true,
      domicilio: true,
    },
  });

  console.log(`Total usuarios sin coordenadas: ${sinCoords.length}`);

  // Normalization logic for clean grouping
  function getGrupo(raw: string | null): string {
    if (!raw || !raw.trim()) return "(SIN DOMICILIO)";
    let d = raw.trim().toUpperCase();

    // Fix encoding bugs
    const dFixed = d.replace(/ﾑ/g, "Ñ").replace(/#/g, "Ñ").replace(/･/g, "Ñ");

    // Barrios Cerrados / Countries / Fincas
    if (d.includes("SMITHFIELD")) return "E.SMITHFIELD";
    if (d.includes("FLORIDA")) return "FINCAS DE LA FLORIDA";
    if (d.includes("FRESNOS")) return "CAMPOS DE FRESNOS";
    if (d.includes("LAS MARIAS") || /L\.?\s*MAR[IÍ]A/.test(d)) return "B. LAS MARIAS";
    if (d.includes("VIPERMUN")) return "B. VIPERMUN";
    if (d.includes("COVEPAN")) return "B. COVEPAN";
    if (/\bUOM\b/.test(d)) return "B. UOM";
    if (d.includes("FONAVI")) return "B. FONAVI";
    if (d.includes("PROCASA")) return "B. PROCASA";
    if (/INS(T)?\.?\s*VIVIENDA/.test(d)) return "B. INST. VIVIENDA";
    if (d.includes("PLAN FED")) return "B. PLAN FEDERAL";
    if (d.includes("ESCALADA")) return "B. ESCALADA";
    if (d.includes("LA CARONA")) return "B. LA CARONA";
    if (d.includes("EL CASAL")) return "EL CASAL";
    if (d.includes("EL BOSQUE")) return "EL BOSQUE";
    if (d.includes("RINCON DEL SAUCE")) return "RINCON DEL SAUCE";
    if (d.includes("CHACRAS DE LA CRUZ")) return "CHACRAS DE LA CRUZ";
    if (d.includes("CANAL MARTIN IRIGOYEN")) return "CANAL MARTIN IRIGOYEN";
    if (d.includes("ALDEA SUIZA")) return "ALDEA SUIZA";
    if (d.includes("LA CAMPIÑA") || d.includes("CAMPIÑA")) return "LA CAMPIÑA";
    if (d.includes("DEL CASCO") || d.includes("A.DEL CASCO")) return "ALTOS DEL CASCO";
    if (d.includes("LOS CEIBOS") || d.includes("L.CEIBOS")) return "B. LOS CEIBOS";
    if (d.includes("LOS ROBLES") || d.includes("L.ROBLES")) return "B. LOS ROBLES";
    if (d.includes("VICTORIA") || d.includes("B.VICTORIA")) return "B. VICTORIA";
    if (d.includes("VIZA") || d.includes("B.VIZA")) return "B. VIZA";
    if (d.includes("GOLF PARK") || d.includes("Z.GOLF PARK")) return "ZARATE GOLF PARK";
    if (d.includes("DON MARCOS")) return "B. DON MARCOS";
    if (d.includes("UNION Y FE") || d.includes("UNION Y FUERZA") || d.includes("U.Y FUERZA")) return "B. UNION Y FE / FUERZA";
    if (d.includes("MATADERO")) return "B. MATADERO";
    if (d.includes("VOLUNTARIOS")) return "B. VOLUNTARIOS";
    if (d.includes("SAN JORGE")) return "B. SAN JORGE";
    if (d.includes("QUEBRADA")) return "B. QUEBRADA";
    if (d.includes("LOS NARANJOS") || d.includes("L.NARANJOS")) return "B. LOS NARANJOS";
    if (d.includes("VILLA LIA")) return "VILLA LIA";
    if (d.includes("L.MIRTILLOS") || d.includes("MIRTILLOS")) return "L. MIRTILLOS II";

    // Known streets with variations
    if (/BERUT+I/.test(dFixed)) return "BERUTTI";
    if (/AR+IBE[ÑN]OS/.test(dFixed)) return "ARRIBEÑOS";
    if (/ESPA[ÑN]A/.test(dFixed)) return "ESPAÑA";
    if (/S(?:G)?TO\.?\s*CABRAL/.test(dFixed)) return "SGTO. CABRAL";
    if (/PAS+O/.test(dFixed)) return "J.J. PASO";
    if (/INDEPEND/.test(dFixed)) return "INDEPENDENCIA";
    if (/AMEGHINO/.test(dFixed)) return "AMEGHINO";
    if (/9\s+DE\s+JULIO/.test(dFixed)) return "9 DE JULIO";
    if (/25\s+DE\s+MAYO/.test(dFixed)) return "25 DE MAYO";
    if (/3\s+DE\s+FEBRERO/.test(dFixed)) return "3 DE FEBRERO";
    if (/1\s+DE\s+MAYO/.test(dFixed)) return "1 DE MAYO";
    if (/11\s+DE\s+NOVIEMBRE|11\s+DE\s+NOVIEMB/.test(dFixed)) return "11 DE NOVIEMBRE";
    if (/19\s+DE\s+MARZO/.test(dFixed)) return "19 DE MARZO";
    if (/R(?:OMULO|\.)?\s*NOYA/.test(dFixed)) return "ROMULO NOYA";
    if (/G(?:RAL)?\.?\s*PAZ/.test(dFixed)) return "GRAL. PAZ";
    if (/(?:H\.?\s*)?(?:YRIGOYEN|IRIGOYEN)/.test(dFixed)) return "HIPOLITO YRIGOYEN";
    if (/(?:B\.?\s*)?MITRE/.test(dFixed)) return "BARTOLOME MITRE";
    if (/ITUZAINGO/.test(dFixed)) return "ITUZAINGO";
    if (/A(?:RISTOBULO|\.)?\s*DEL\s*VALLE/.test(dFixed)) return "A. DEL VALLE";
    if (/RIVADAVIA/.test(dFixed)) return "RIVADAVIA";
    if (/J(?:USTA|\.)?\s*LIMA/.test(dFixed)) return "JUSTA LIMA";
    if (/CASTELLI/.test(dFixed)) return "CASTELLI";
    if (/SAN\s+MARTIN/.test(dFixed)) return "SAN MARTIN";
    if (/A(?:LTE|\.)?\s*BROWN/.test(dFixed)) return "ALMIRANTE BROWN";
    if (/ALEM/.test(dFixed)) return "LEANDRO N. ALEM";
    if (/BOLIVAR/.test(dFixed)) return "BOLIVAR";
    if (/DE\s+LA\s+TORRE/.test(dFixed)) return "L. DE LA TORRE";
    if (/GALLESIO|A\.GALLESIO/.test(dFixed)) return "A. GALLESIO";
    if (/BELGRANO/.test(dFixed)) return "BELGRANO";
    if (/M(?:ARCOS|\.)?\s*PAZ/.test(dFixed)) return "MARCOS PAZ";
    if (/ALSINA|V\.ALSINA/.test(dFixed)) return "VALENTIN ALSINA";
    if (/F(?:ELIX|\.)?\s*PAGOLA/.test(dFixed)) return "FELIX PAGOLA";
    if (/PINTO|GRAL\.?\s*PINTO/.test(dFixed)) return "GRAL. PINTO";
    if (/ROQUE\s+PEÑA|R\.?\s*PEÑA/.test(dFixed)) return "ROQUE PEÑA";
    if (/SAENZ\s+PEÑA|S\.?\s*PEÑA/.test(dFixed)) return "SAENZ PEÑA";
    if (/GUEMES/.test(dFixed)) return "GUEMES";
    if (/ECHEVERRIA/.test(dFixed)) return "ECHEVERRIA";
    if (/PJE\.?\s*RIOJA|RIOJA/.test(dFixed)) return "PJE. RIOJA";
    if (/LAVALLE/.test(dFixed)) return "LAVALLE";
    if (/MORENO/.test(dFixed)) return "MORENO";
    if (/RAWSON/.test(dFixed)) return "RAWSON";
    if (/LAPRIDA/.test(dFixed)) return "LAPRIDA";
    if (/CHACABUCO/.test(dFixed)) return "CHACABUCO";
    if (/LINIERS/.test(dFixed)) return "LINIERS";
    if (/SUIPACHA/.test(dFixed)) return "SUIPACHA";
    if (/ANTARTIDA\s+ARG/.test(dFixed)) return "ANTARTIDA ARGENTINA";
    if (/URQUIZA/.test(dFixed)) return "URQUIZA";
    if (/CONESA/.test(dFixed)) return "CONESA";
    if (/PELLEGRINI/.test(dFixed)) return "CARLOS PELLEGRINI";
    if (/AVELLANEDA/.test(dFixed)) return "AVELLANEDA";
    if (/SAN\s+JERONIMO/.test(dFixed)) return "SAN JERONIMO";
    if (/LUCIO\s+MANSILLA|L\.?\s*MANSILLA/.test(dFixed)) return "LUCIO MANSILLA";
    if (/T(?:EOFILO|\.)?\s*FELS/.test(dFixed)) return "TEOFILO FELS";
    if (/A(?:NIBAL|\.)?\s*PONCE/.test(dFixed)) return "ANIBAL PONCE";
    if (/PIEDRABUENA|PIDRABUENA|PIEDARBUENA/.test(dFixed)) return "PIEDRABUENA";
    if (/CNO|CAMINO/.test(dFixed)) {
      return dFixed.replace(/\s+(?:S\/N|\d+|KM).*$/, "").trim();
    }

    // Default: strip numbers, depto, piso
    let limpio = dFixed
      .replace(/\b(PISO|P\.?|DEPTO|DTO|DPTO|PB|LOCAL|CASA|C\.|MANZANA|MZ|LOTE|LT|QUINTA|QTA|CHACRA|CH|FONDO|INTER|INTERNO|FRENTE|BIS)\b.*$/i, "")
      .replace(/[,\-\/].*$/, "")
      .trim();

    const m = limpio.match(/^([A-Za-z\s\.\'\-]+?)\s+\d+/);
    if (m) {
      limpio = m[1];
    }

    return limpio.replace(/^[:\s\.\-]+|[:\s\.\-]+$/g, "").trim() || dFixed;
  }

  const conteo: Record<string, number> = {};
  for (const u of sinCoords) {
    const g = getGrupo(u.domicilio);
    conteo[g] = (conteo[g] || 0) + 1;
  }

  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

  console.log("\n--- RESULTADO AGRUPADO ---");
  for (const [calle, cant] of sorted) {
    console.log(`${calle}=${cant}`);
  }

  fs.writeFileSync("scripts/conteo_final.json", JSON.stringify(sorted, null, 2));
}

main().finally(() => prisma.$disconnect());
