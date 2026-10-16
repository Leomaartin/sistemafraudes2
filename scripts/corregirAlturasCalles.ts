import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { parsearDireccionZarate } from "./geolocalizarUsuarios";

const OSM_FILE = path.join(process.cwd(), "migracion", "calles_geometria_osm.json");

interface Point {
  lat: number;
  lon: number;
}

interface CalleInfo {
  nombreNorm: string;
  nombreOSM: string;
  polyline: Point[];
  longitudMetros: number;
}

const ALIASES: Record<string, string> = {
  "L.Y PLANES": "VICENTE LOPEZ Y PLANES",
  "L Y PLANES": "VICENTE LOPEZ Y PLANES",
  "E.CARRIEGO": "EVARISTO CARRIEGO",
  "G.SPANO": "CARLOS GUIDO SPANO",
  "V.ALSINA": "VALENTIN ALSINA",
  "B.IRIGOYEN": "BERNARDO DE IRIGOYEN",
  "J.A.COSTA": "LUIS COSTA",
  "COSTA": "LUIS COSTA",
  "B.ROLDAN": "BELISARIO ROLDAN",
  "SGTO.CABRAL": "SARGENTO CABRAL",
  "M.SASTRE": "MARCOS SASTRE",
  "T.FELS": "TEODORO FELS",
  "A.STORNI": "ALFONSINA STORNI",
  "I.MALVINAS": "ISLAS MALVINAS",
  "D.MARIMON": "DOMINGO MARIMON",
  "MARIMON": "DOMINGO MARIMON",
  "J.LIMA": "JUSTA LIMA DE ATUCHA",
  "P.MARTINI": "PEDRO MARTINI",
  "MARTINI": "PEDRO MARTINI",
  "P.PITRAU": "PEDRO PITRAU",
  "PITRAU": "PEDRO PITRAU",
  "J.INGENIEROS": "JOSE INGENIEROS",
  "A.PACHECO": "ALFEREZ PACHECO",
  "PACHECO": "ALFEREZ PACHECO",
  "A.MELILLO": "AGUSTIN MELILLO",
  "MELILLO": "AGUSTIN MELILLO",
  "L.MEDINA": "LUIS MEDINA",
  "MEDINA": "LUIS MEDINA",
  "G.QUIRNO": "QUIRNO",
  "U.FERNANDEZ": "UBALDO FERNANDEZ",
  "FERNANDEZ": "UBALDO FERNANDEZ",
  "PJE.RIOJA": "LA RIOJA",
  "H.YRIGOYEN": "HIPOLITO YRIGOYEN",
  "B.MITRE": "BARTOLOME MITRE",
  "MITRE": "BARTOLOME MITRE",
  "J.B.JUSTO": "JUAN B. JUSTO",
  "J.J.PASSO": "JUAN JOSE PASO",
  "PASSO": "JUAN JOSE PASO",
  "R.NOYA": "ROMULO NOYA",
  "A.GALLESIO": "AVENIDA GALLESIO",
  "GALLESIO": "AVENIDA GALLESIO",
  "A.ANTA": "AVENIDA ANTARTIDA ARGENTINA",
  "A.ARGENTINA": "AVENIDA ANTARTIDA ARGENTINA",
  "ANTARTIDA ARGENTINA": "AVENIDA ANTARTIDA ARGENTINA",
  "F.PAGOLA": "FELIX PAGOLA",
  "PAGOLA": "FELIX PAGOLA",
  "A.DEL VALLE": "ARISTOBULO DEL VALLE",
  "DEL VALLE": "ARISTOBULO DEL VALLE",
  "A.BROWN": "ALMIRANTE BROWN",
  "BROWN": "ALMIRANTE BROWN",
  "A.ALSINA": "ADOLFO ALSINA",
  "ALSINA": "ADOLFO ALSINA",
  "J.HERNANDEZ": "JOSE HERNANDEZ",
  "S.PENA": "SAENZ PENA",
  "SAENZ PENA": "SAENZ PENA",
  "R.PENA": "RODRIGUEZ PENA",
  "RODRIGUEZ PENA": "RODRIGUEZ PENA",
  "M.CASTELLI": "CASTELLI",
  "P.A.SARMIENTO": "SARMIENTO",
  "SAAVEDRA": "DIONISIO SAAVEDRA",
  "ESPAÑA": "ESPANA",
  "ESPANA": "ESPANA",
  "ARRIBEÑOS": "ARRIBENOS",
  "ARRIBENOS": "ARRIBENOS",
  "ALEM": "LEANDRO ALEM",
  "L.ALEM": "LEANDRO ALEM",
  "LEANDRO N. ALEM": "LEANDRO ALEM",
  "LEANDRO ALEM": "LEANDRO ALEM",
  "JUSTA LIMA": "JUSTA LIMA DE ATUCHA",
  "JUSTA LIMA DE ATUCHA": "JUSTA LIMA DE ATUCHA",
  "PEDRO MARTINI": "PEDRO MARTINI",
  "PEDRO PITRAU": "PEDRO PITRAU",
};

function normalizarTexto(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/^(CALLE|AVENIDA|AVDA|AV|PASAJE|PJE|BV|BOULEVARD|GRAL|GENERAL|CNEL|CORONEL|TTE|TENIENTE|ALTE|ALMIRANTE|BARTOLOME|HIPOLITO|PRESIDENTE)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function encadenarWays(ways: any[]): Point[] {
  if (ways.length === 0) return [];
  const segments: Point[][] = ways
    .map((w) => w.geometry as Point[])
    .filter((g) => g && g.length > 1);

  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];

  segments.sort((a, b) => b.length - a.length);
  let chain: Point[] = [...segments[0]];
  const remaining = segments.slice(1);

  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let attachToStart = false;
    let reverseCandidate = false;

    const startNode = chain[0];
    const endNode = chain[chain.length - 1];

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const segStart = seg[0];
      const segEnd = seg[seg.length - 1];

      const d1 = Math.hypot(endNode.lat - segStart.lat, endNode.lon - segStart.lon);
      if (d1 < bestDist) {
        bestDist = d1;
        bestIdx = i;
        attachToStart = false;
        reverseCandidate = false;
      }
      const d2 = Math.hypot(endNode.lat - segEnd.lat, endNode.lon - segEnd.lon);
      if (d2 < bestDist) {
        bestDist = d2;
        bestIdx = i;
        attachToStart = false;
        reverseCandidate = true;
      }
      const d3 = Math.hypot(startNode.lat - segEnd.lat, startNode.lon - segEnd.lon);
      if (d3 < bestDist) {
        bestDist = d3;
        bestIdx = i;
        attachToStart = true;
        reverseCandidate = false;
      }
      const d4 = Math.hypot(startNode.lat - segStart.lat, startNode.lon - segStart.lon);
      if (d4 < bestDist) {
        bestDist = d4;
        bestIdx = i;
        attachToStart = true;
        reverseCandidate = true;
      }
    }

    if (bestIdx === -1 || bestDist > 0.02) break;

    let chosen = remaining.splice(bestIdx, 1)[0];
    if (reverseCandidate) chosen = [...chosen].reverse();

    if (attachToStart) chain = [...chosen, ...chain];
    else chain = [...chain, ...chosen];
  }

  return chain;
}

function calcularLongitudMetros(polyline: Point[]): number {
  let dist = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dLat = (polyline[i + 1].lat - polyline[i].lat) * 111139;
    const dLon = (polyline[i + 1].lon - polyline[i].lon) * 92000;
    dist += Math.hypot(dLat, dLon);
  }
  return dist;
}

function interpolarPuntoEnPolilinea(polyline: Point[], distanciaMetros: number, esPar: boolean, jitterSeed: number): Point {
  if (polyline.length === 0) return { lat: 0, lon: 0 };
  if (polyline.length === 1) return polyline[0];

  let distRestante = Math.max(0, distanciaMetros);

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    const dLat = (p2.lat - p1.lat) * 111139;
    const dLon = (p2.lon - p1.lon) * 92000;
    const segLen = Math.hypot(dLat, dLon);

    if (distRestante <= segLen || i === polyline.length - 2) {
      const t = segLen > 0 ? Math.min(1, Math.max(0, distRestante / segLen)) : 0;
      const baseLat = p1.lat + t * (p2.lat - p1.lat);
      const baseLon = p1.lon + t * (p2.lon - p1.lon);

      // Desplazamiento perpendicular para vereda (5 metros a cada lado)
      const nx = -dLat / (segLen || 1);
      const ny = dLon / (segLen || 1);
      const offsetSide = esPar ? 5 : -5;
      const sideLat = (ny * offsetSide) / 111139;
      const sideLon = (nx * offsetSide) / 92000;

      // Micro-dispersión determinista para departamentos/unidades en la misma altura (1 a 3 metros)
      let hash = 0;
      const str = String(jitterSeed);
      for (let j = 0; j < str.length; j++) {
        hash = (hash << 5) - hash + str.charCodeAt(j);
        hash |= 0;
      }
      const microLat = (((Math.abs(hash) % 100) - 50) / 50) * 0.000025;
      const microLon = ((((Math.abs(hash * 31) % 100) - 50) / 50) * 0.000025);

      return {
        lat: baseLat + sideLat + microLat,
        lon: baseLon + sideLon + microLon,
      };
    }

    distRestante -= segLen;
  }

  return polyline[polyline.length - 1];
}

// Cargar y procesar todas las polilíneas de OSM
function cargarRedCallesOSM(): { callasIndexadas: Record<string, CalleInfo>; listaCalles: CalleInfo[] } {
  const osmData = JSON.parse(fs.readFileSync(OSM_FILE, "utf-8"));
  const waysPorNombre: Record<string, any[]> = {};

  for (const el of osmData.elements) {
    const rawName = el.tags?.name?.trim();
    if (!rawName) continue;
    const norm = normalizarTexto(rawName);
    if (!waysPorNombre[norm]) waysPorNombre[norm] = [];
    waysPorNombre[norm].push(el);
  }

  const callasIndexadas: Record<string, CalleInfo> = {};
  const listaCalles: CalleInfo[] = [];

  for (const [normName, ways] of Object.entries(waysPorNombre)) {
    const polyline = encadenarWays(ways);
    if (polyline.length < 2) continue;
    const longitudMetros = calcularLongitudMetros(polyline);
    const info: CalleInfo = {
      nombreNorm: normName,
      nombreOSM: ways[0].tags?.name || normName,
      polyline,
      longitudMetros,
    };
    callasIndexadas[normName] = info;
    listaCalles.push(info);
  }

  return { callasIndexadas, listaCalles };
}

// Determina la orientación (Punto A como inicio vs Punto B) según la cuadrícula urbana de Zárate
function orientarPolilinea(polyline: Point[], nombreCalle: string): Point[] {
  if (polyline.length < 2) return polyline;

  const pInicio = polyline[0];
  const pFin = polyline[polyline.length - 1];

  // Calles perpendiculares al Paraná (Rivadavia, Belgrano, San Martín, Justa Lima, Brown, Pinto, Gallesio, Antártida Argentina):
  // La altura 0/100 empieza cerca del río (Noreste: mayor latitud/mayor longitud) y crece hacia el Sudoeste (menor latitud/menor longitud).
  const esPerpendicular = /RIVADAVIA|BELGRANO|SAN MARTIN|JUSTA LIMA|BROWN|PINTO|GALLESIO|ANTARTIDA|ITUZAINGO|19 DE MARZO|CASTELLI|RAWSON|LAVALLE/i.test(nombreCalle);
  if (esPerpendicular) {
    // Debe empezar en el Noreste (mayor latitud, es decir menos negativa, -34.09 > -34.13)
    if (pInicio.lat < pFin.lat) {
      return [...polyline].reverse();
    }
    return polyline;
  }

  // Calles al norte de Rivadavia (Pueyrredón, Soler, Urquiza, Matheu, etc.):
  // Empiezan cerca de Rivadavia (Sudeste: lat más negativa, -34.09) y crecen hacia el Noroeste (lat menos negativa, -34.08)
  const esNorteDeRivadavia = /PUEYRREDON|SOLER|URQUIZA|MATHEU|SARMIENTO|ESTRADA|AMEGHINO|JUAN JOSE PASO|PASO|JUAN B. JUSTO/i.test(nombreCalle);
  if (esNorteDeRivadavia) {
    // Si empieza en el Noroeste (lat > fin), invertir para que empiece en Rivadavia
    if (pInicio.lat > pFin.lat) {
      return [...polyline].reverse();
    }
    return polyline;
  }

  // Calles al sur de Rivadavia (Larrea, Dorrego, Alberti, French, Berutti, Alem, etc.):
  // Empiezan cerca de Rivadavia/Río (Noreste) y crecen hacia el Sudoeste
  if (pInicio.lat < pFin.lat) {
    return [...polyline].reverse();
  }
  return polyline;
}

function buscarCalleOSM(calleUsuario: string, callasIndexadas: Record<string, CalleInfo>, listaCalles: CalleInfo[]): CalleInfo | null {
  const normDirecta = normalizarTexto(calleUsuario);

  // 1. Coincidencia directa
  if (callasIndexadas[normDirecta]) return callasIndexadas[normDirecta];

  // 2. Coincidencia por alias
  const alias = ALIASES[normDirecta] || ALIASES[calleUsuario.toUpperCase()];
  if (alias) {
    const normAlias = normalizarTexto(alias);
    if (callasIndexadas[normAlias]) return callasIndexadas[normAlias];
  }

  // 3. Coincidencia si el nombre está contenido
  for (const c of listaCalles) {
    if (c.nombreNorm === normDirecta) return c;
    if (c.nombreNorm.length > 4 && normDirecta.includes(c.nombreNorm)) return c;
    if (normDirecta.length > 4 && c.nombreNorm.includes(normDirecta)) return c;
  }

  return null;
}

async function main() {
  const esDryRun = process.argv.includes("--dry-run");

  console.log("\n=======================================================");
  console.log("🗺️  CORRECTOR DE ALTURAS Y DISTRIBUCIÓN DE CALLES (ZÁRATE)");
  console.log("=======================================================\n");

  if (esDryRun) {
    console.log("🔍 Modo: DRY-RUN (simulación, sin guardar en base de datos)\n");
  } else {
    console.log("⚡ Modo: APLICACIÓN DIRECTA EN BASE DE DATOS\n");
  }

  const { callasIndexadas, listaCalles } = cargarRedCallesOSM();
  console.log(`📦 Red vial de OSM cargada: ${listaCalles.length} calles con polilínea unificada`);

  const usuarios = await prisma.usuario.findMany({
    where: { domicilio: { not: null } },
    select: { id: true, nroUsuario: true, domicilio: true, ruta: true, latitud: true, longitud: true },
    orderBy: { id: "asc" },
  });

  console.log(`👥 Total usuarios en sistema: ${usuarios.length.toLocaleString()}`);

  let corregidos = 0;
  let omitidosBarrio = 0;
  let omitidosSinAltura = 0;
  let noEncontradosOSM = 0;
  const updates: Array<{ id: number; lat: number; lon: number }> = [];

  for (let i = 0; i < usuarios.length; i++) {
    const user = usuarios[i];
    const dom = user.domicilio!.trim();
    const parsed = parsearDireccionZarate(dom, user.ruta || undefined);

    if (parsed.esBarrio) {
      omitidosBarrio++;
      continue;
    }

    if (!parsed.altura || parsed.altura <= 0) {
      omitidosSinAltura++;
      continue;
    }

    const calleRaw = parsed.consultaCalleGeneral?.replace(", Zarate, Buenos Aires, Argentina", "").replace(", Lima, Buenos Aires, Argentina", "").trim() || "";
    const matchOSM = buscarCalleOSM(calleRaw, callasIndexadas, listaCalles);

    if (!matchOSM) {
      noEncontradosOSM++;
      continue;
    }

    // Orientar polilínea
    const polylineOrientada = orientarPolilinea(matchOSM.polyline, matchOSM.nombreNorm);

    // Calcular distancia estimada en metros a lo largo de la calle
    // Regla estándar: ~110 metros por cada 100 números de altura
    const distMetros = (parsed.altura / 100) * 110;
    const esPar = parsed.altura % 2 === 0;

    const nuevaCoord = interpolarPuntoEnPolilinea(polylineOrientada, distMetros, esPar, user.id);

    updates.push({
      id: user.id,
      lat: nuevaCoord.lat,
      lon: nuevaCoord.lon,
    });
    corregidos++;

    if (corregidos <= 10 || corregidos % 1000 === 0) {
      console.log(`[${corregidos}] ✅ #${user.nroUsuario} (${dom}) -> Calle: "${matchOSM.nombreOSM}", Altura: ${parsed.altura} -> Lat: ${nuevaCoord.lat.toFixed(5)}, Lon: ${nuevaCoord.lon.toFixed(5)}`);
    }
  }

  console.log("\n=======================================================");
  console.log("📊 RESUMEN DE PROCESAMIENTO");
  console.log("=======================================================");
  console.log(`✅ Usuarios corregidos con altura real:  ${corregidos.toLocaleString()}`);
  console.log(`🏘️  Usuarios en barrios (mantenidos):    ${omitidosBarrio.toLocaleString()}`);
  console.log(`⚠️  Usuarios sin número de altura:       ${omitidosSinAltura.toLocaleString()}`);
  console.log(`❓ Calles no ubicadas en OSM:            ${noEncontradosOSM.toLocaleString()}`);

  if (!esDryRun && updates.length > 0) {
    console.log(`\n💾 Guardando actualizaciones en la base de datos...`);
    const BATCH_SIZE = 500;
    for (let b = 0; b < updates.length; b += BATCH_SIZE) {
      const batch = updates.slice(b, b + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((u) =>
          prisma.usuario.update({
            where: { id: u.id },
            data: {
              latitud: u.lat,
              longitud: u.lon,
              maps: `https://www.google.com/maps?q=${u.lat.toFixed(6)},${u.lon.toFixed(6)}`,
            },
          })
        )
      );
      process.stdout.write(`   Guardados ${Math.min(b + BATCH_SIZE, updates.length)} / ${updates.length}...\r`);
    }
    console.log(`\n🎉 ¡Todas las alturas de las calles se actualizaron exitosamente!\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
