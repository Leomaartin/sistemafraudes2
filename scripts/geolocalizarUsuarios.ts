import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

// ==========================================
// CONFIGURACIÓN Y NORMALIZACIÓN DE DIRECCIONES DE ZÁRATE
// ==========================================

const CACHE_FILE = path.join(process.cwd(), "migracion", "geocoding_cache.json");

// Coordenadas verificadas de Barrios / Zonas de Zárate
export const COORDENADAS_BARRIOS: Record<string, { lat: number; lon: number; radio: number }> = {
  SMITHFIELD: { lat: -34.1205123, lon: -59.0090123, radio: 0.0035 },
  "ESTANCIA SMITHFIELD": { lat: -34.1205123, lon: -59.0090123, radio: 0.0035 },
  "ALTOS DEL CASCO": { lat: -34.1315833, lon: -59.0902249, radio: 0.0035 },
  "LOS MIRTILLOS": { lat: -34.1335017, lon: -59.0803791, radio: 0.0030 },
  "LOS MIRTILLOS II": { lat: -34.1335017, lon: -59.0803791, radio: 0.0030 },
  "FINCAS DE LA FLORIDA": { lat: -34.1414285, lon: -59.0781668, radio: 0.0040 },
  "LA FLORIDA": { lat: -34.1414285, lon: -59.0781668, radio: 0.0040 },
  "LA CAMPIÑA": { lat: -34.1245000, lon: -59.0715000, radio: 0.0035 },
  ESPAÑA: { lat: -34.0972675, lon: -59.0583774, radio: 0.0025 },
  "BARRIO ESPAÑA": { lat: -34.0972675, lon: -59.0583774, radio: 0.0025 },
  VIPERMUN: { lat: -34.1213516, lon: -59.0693766, radio: 0.0025 },
  FONAVI: { lat: -34.1145789, lon: -59.0164705, radio: 0.0020 },
  ESCALADA: { lat: -34.1384315, lon: -59.1022560, radio: 0.0040 },
  "SAN MIGUEL": { lat: -34.1159225, lon: -59.0604075, radio: 0.0025 },
  COVEPAN: { lat: -34.1121000, lon: -59.0435000, radio: 0.0025 },
  VICTORIA: { lat: -34.1105000, lon: -59.0392000, radio: 0.0025 },
  VIZA: { lat: -34.1132000, lon: -59.0361000, radio: 0.0025 },
  "DON MARCOS": { lat: -34.1165000, lon: -59.0632000, radio: 0.0025 },
  "SAN JORGE": { lat: -34.1082000, lon: -59.0551000, radio: 0.0025 },
  MATADERO: { lat: -34.1042000, lon: -59.0478000, radio: 0.0025 },
  "PLAN FEDERAL": { lat: -34.1128000, lon: -59.0512000, radio: 0.0025 },
  FERROVIARIO: { lat: -34.1025000, lon: -59.0123000, radio: 0.0025 },
  VOLUNTARIOS: { lat: -34.1118000, lon: -59.0589000, radio: 0.0025 },
  METEOR: { lat: -34.1135000, lon: -59.0505000, radio: 0.0020 },
  "EL NOGAL": { lat: -34.1275000, lon: -59.0680000, radio: 0.0030 },
  "LAS LOMAS": { lat: -34.1290000, lon: -59.0650000, radio: 0.0030 },
  "LAS PICADAS": { lat: -34.1350000, lon: -59.0720000, radio: 0.0030 },
  SAAVEDRA: { lat: -34.1125000, lon: -59.0340000, radio: 0.0025 },
};

export interface DireccionInfo {
  esBarrio: boolean;
  barrioKey?: string;
  consultasConNumero: string[];
  consultaCalleGeneral?: string;
  altura?: number;
}

// Genera una dispersión determinista (jitter) para que usuarios en un mismo barrio no queden apilados
export function generarJitter(semilla: string | number, radio: number = 0.0015): { latOffset: number; lonOffset: number } {
  const str = String(semilla);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 10000) / 10000;
  const normalizedAngle = Math.abs((hash * 31) % 10000) / 10000;
  const angle = normalizedAngle * 2 * Math.PI;
  const dist = (0.15 + 0.85 * Math.sqrt(normalized)) * radio;
  return {
    latOffset: Math.sin(angle) * dist,
    lonOffset: Math.cos(angle) * dist * 1.2,
  };
}

export function detectarBarrio(domicilio: string): { barrioKey: string; coords: { lat: number; lon: number; radio: number } } | null {
  const d = domicilio.toUpperCase();

  if (d.includes("SMITHFIELD")) return { barrioKey: "ESTANCIA SMITHFIELD", coords: COORDENADAS_BARRIOS["ESTANCIA SMITHFIELD"] };
  if (d.includes("DEL CASCO") || d.includes("ALTOS DEL CASCO")) return { barrioKey: "ALTOS DEL CASCO", coords: COORDENADAS_BARRIOS["ALTOS DEL CASCO"] };
  if (d.includes("MIRTILLOS")) return { barrioKey: "LOS MIRTILLOS II", coords: COORDENADAS_BARRIOS["LOS MIRTILLOS II"] };
  if (d.includes("FLORIDA")) return { barrioKey: "FINCAS DE LA FLORIDA", coords: COORDENADAS_BARRIOS["FINCAS DE LA FLORIDA"] };
  if (d.includes("CAMPIÑA") || d.includes("CAMPINA")) return { barrioKey: "LA CAMPIÑA", coords: COORDENADAS_BARRIOS["LA CAMPIÑA"] };
  if (/^(?:B\.?|B°|BARRIO)\s*ESPA/i.test(domicilio) || (d.includes("ESPAÑA") && !/\b\d{1,5}\b/.test(domicilio))) return { barrioKey: "BARRIO ESPAÑA", coords: COORDENADAS_BARRIOS["BARRIO ESPAÑA"] };
  if (d.includes("VIPERMUN") || d.includes("VIP")) return { barrioKey: "VIPERMUN", coords: COORDENADAS_BARRIOS["VIPERMUN"] };
  if (d.includes("FONAVI")) return { barrioKey: "FONAVI", coords: COORDENADAS_BARRIOS["FONAVI"] };
  if (d.includes("ESCALADA")) return { barrioKey: "ESCALADA", coords: COORDENADAS_BARRIOS["ESCALADA"] };
  if (d.includes("SAN MIGUEL")) return { barrioKey: "SAN MIGUEL", coords: COORDENADAS_BARRIOS["SAN MIGUEL"] };
  if (d.includes("COVEPAN")) return { barrioKey: "COVEPAN", coords: COORDENADAS_BARRIOS["COVEPAN"] };
  if (d.includes("VICTORIA")) return { barrioKey: "VICTORIA", coords: COORDENADAS_BARRIOS["VICTORIA"] };
  if (d.includes("VIZA")) return { barrioKey: "VIZA", coords: COORDENADAS_BARRIOS["VIZA"] };
  if (d.includes("DON MARCOS")) return { barrioKey: "DON MARCOS", coords: COORDENADAS_BARRIOS["DON MARCOS"] };
  if (d.includes("SAN JORGE")) return { barrioKey: "SAN JORGE", coords: COORDENADAS_BARRIOS["SAN JORGE"] };
  if (d.includes("MATADERO")) return { barrioKey: "MATADERO", coords: COORDENADAS_BARRIOS["MATADERO"] };
  if (d.includes("PLAN FED")) return { barrioKey: "PLAN FEDERAL", coords: COORDENADAS_BARRIOS["PLAN FEDERAL"] };
  if (d.includes("FERROVIARIO")) return { barrioKey: "FERROVIARIO", coords: COORDENADAS_BARRIOS["FERROVIARIO"] };
  if (d.includes("VOLUNTARIOS")) return { barrioKey: "VOLUNTARIOS", coords: COORDENADAS_BARRIOS["VOLUNTARIOS"] };
  if (d.includes("METEOR")) return { barrioKey: "METEOR", coords: COORDENADAS_BARRIOS["METEOR"] };
  if (d.includes("NOGAL")) return { barrioKey: "EL NOGAL", coords: COORDENADAS_BARRIOS["EL NOGAL"] };
  if (d.includes("LOMAS")) return { barrioKey: "LAS LOMAS", coords: COORDENADAS_BARRIOS["LAS LOMAS"] };
  if (d.includes("PICADAS")) return { barrioKey: "LAS PICADAS", coords: COORDENADAS_BARRIOS["LAS PICADAS"] };
  if (/^(?:B\.?|B°|BARRIO)\s*SAAVEDRA/i.test(domicilio) || (d.includes("SAAVEDRA") && !/\b\d{1,5}\b/.test(domicilio))) return { barrioKey: "SAAVEDRA", coords: COORDENADAS_BARRIOS["SAAVEDRA"] };

  return null;
}

export function parsearDireccionZarate(domicilio: string, ruta?: string | number): DireccionInfo {
  const rutaNum = ruta ? parseInt(String(ruta).trim(), 10) : NaN;
  const esLima = (!isNaN(rutaNum) && rutaNum >= 200 && rutaNum < 300) || /LIMA\b/i.test(domicilio);
  const localidad = esLima ? "Lima" : "Zarate";

  // Primero revisar si es un barrio conocido que debe ubicarse directamente en el barrio
  const barrio = detectarBarrio(domicilio);
  if (barrio && !esLima) {
    return {
      esBarrio: true,
      barrioKey: barrio.barrioKey,
      consultasConNumero: [],
    };
  }

  let limpio = domicilio
    .trim()
    .replace(/^[:\s\-]+/, "")
    .replace(/\b(PISO|PA|PA\.|PB|PB\.|DEPTO|DTO|DPTO|LOCAL|CASA|MANZANA|MZ|LOTE|LT|UF|U\.F|CONS|CONSORCIO)\b.*$/i, "")
    .replace(/\bP\.?\s*\d+.*$/i, "")
    .replace(/\b\d+°\s*["'A-Z]?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Quitar sufijo de localidad Lima solo al final si no es la calle Justa Lima
  if (!/^(?:J\.?\s*LIMA|JUSTA\s*LIMA)\b/i.test(limpio)) {
    limpio = limpio.replace(/[, \-]+LIMA$/i, "").trim();
  }

  // Quitar tildes temporalmente para la separación limpia de calle y altura
  const sinTildes = limpio
    .replace(/ﾑ/g, "Ñ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Extraer nombre de calle y altura considerando calles numeradas (típicas de Lima y barrios)
  const matchCalleNum = sinTildes.match(/^(?:CALLE|C\.|C|CLLE)\s*(\d+[A-Z]?)\b\s*(?:N[°\.\s]*)?(\d+)?/i);
  const matchAvNum = sinTildes.match(/^(?:AVDA|AV|AVDA\.|AV\.|AVENIDA)\s*(\d+[A-Z]?)\b\s*(?:N[°\.\s]*)?(\d+)?/i);
  const matchGeneral = sinTildes.match(/^([a-z\s\.\'\-]+?)\s+(\d+)/i);

  let calle = sinTildes;
  let alturaStr = "";

  if (matchCalleNum) {
    calle = `Calle ${matchCalleNum[1]}`;
    alturaStr = matchCalleNum[2] || "";
  } else if (matchAvNum) {
    calle = matchAvNum[1] === "11" ? "Avenida 11" : `Calle ${matchAvNum[1]}`;
    alturaStr = matchAvNum[2] || "";
  } else if (matchGeneral) {
    calle = matchGeneral[1].trim();
    alturaStr = matchGeneral[2].trim();
  }

  // Normalizaciones y expansiones específicas
  let calleExpandida = calle
    .replace(/^(?:B\.?\s*MITRE|BARTOLOME\s+MITRE|AV\.?\s*B\.?\s*MITRE)\b/i, "Mitre")
    .replace(/^(?:H\.?\s*[YI]R[A-Z]{3,8}N|HIP[OÓ]LITO\s+[A-Z]*[YI]R[A-Z]+N)\b/i, "Hipolito Yrigoyen")
    .replace(/^BERUT+I\b/i, "Beruti")
    .replace(/^(?:J\.?\s*J\.?\s*PAS+O|JUAN\s+JOS[EÉ]\s+PASO|PASSO)\b/i, "Juan Jose Paso")
    .replace(/^(?:R\.?\s*NOYA|ROMULO\s+NOYA|RÓMULO\s+NOYA)\b/i, "Romulo Noya")
    .replace(/^AR+IBE[ÑN]OS\b/i, "Arribeños")
    .replace(/^(?:A\.?\s*ANTA|A\.?\s*ARGENTINA|AV\.?\s*ANTARTIDA\s+ARGENTINA)\b/i, "Avenida Antartida Argentina")
    .replace(/^(?:A\.?\s*GALLESIO|AV\.?\s*GALLESIO)\b/i, "Avenida Gallesio")
    .replace(/^(?:A\.?\s*ALSINA|ADOLFO\s+ALSINA)\b/i, "Alsina")
    .replace(/^(?:A\.?\s*BROWN|AV\.?\s*BROWN|ALTE\.?\s*BROWN)\b/i, "Almirante Brown")
    .replace(/^(?:A\.?\s*DEL\s*VALLE|AV\.?\s*DEL\s*VALLE)\b/i, "Aristobulo del Valle")
    .replace(/^F\.?\s*PAGOLA\b/i, "Felix Pagola")
    .replace(/^GRAL\.?\s*/i, "General ")
    .replace(/^TTE\.?\s*/i, "Teniente ")
    .replace(/^CNEL\.?\s*/i, "Coronel ")
    .replace(/^J\.?\s*B\.?\s*JUSTO\b/i, "Juan B. Justo")
    .replace(/^J\.?\s*HERNANDEZ\b/i, "Jose Hernandez")
    .replace(/^S\.?\s*PEÑA\b/i, "Saenz Peña")
    .replace(/^R\.?\s*PEÑA\b/i, "Rodriguez Peña")
    .replace(/^M\.?\s*CASTELLI\b/i, "Castelli")
    .replace(/^(?:P\.?\s*MARTINI|PEDRO\s+MARTINI)\b/i, "Pedro Martini")
    .replace(/^(?:P\.?\s*PITRAU|PEDRO\s+PITRAU)\b/i, "Pedro Pitrau")
    .replace(/^(?:J\.?\s*LIMA|JUSTA\s+LIMA)\b/i, esLima ? "Avenida 11" : "Justa Lima de Atucha")
    .replace(/^(?:L\.?\s*ALEM|ALEM)\b/i, "Leandro N. Alem")
    .replace(/^SAAVEDRA\b/i, "Saavedra")
    .replace(/^ESPAÑA\b/i, "España")
    .trim();

  let calleCorta = calleExpandida
    .replace(/^(General|Teniente|Coronel|Almirante|Avenida|Barrio)\s+/i, "")
    .trim();

  const consultasConNumero: string[] = [];
  if (alturaStr) {
    consultasConNumero.push(`${calleExpandida} ${alturaStr}, ${localidad}, Buenos Aires, Argentina`);
    if (calleCorta !== calleExpandida) {
      consultasConNumero.push(`${calleCorta} ${alturaStr}, ${localidad}, Buenos Aires, Argentina`);
    }
  }

  const consultaCalleGeneral = `${calleExpandida}, ${localidad}, Buenos Aires, Argentina`;

  return {
    esBarrio: false,
    consultasConNumero: [...new Set(consultasConNumero)],
    consultaCalleGeneral,
    altura: alturaStr ? parseInt(alturaStr, 10) : undefined,
  };
}

function cargarCache(): Record<string, { lat: number; lon: number } | null> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  return {};
}

function guardarCache(cache: Record<string, { lat: number; lon: number } | null>) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (err) {
    console.error("Error al guardar cache:", err);
  }
}

async function geocodificarDireccion(direccionQuery: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccionQuery)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SistemaFraudeZarate/1.0 (contacto@zarate.gob.ar)",
        "Accept-Language": "es",
      },
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("⚠️ Rate limit alcanzado. Esperando 5 segundos...");
        await new Promise((r) => setTimeout(r, 5000));
        return null;
      }
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        return { lat, lon };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ==========================================
// EJECUTOR PRINCIPAL
// ==========================================

async function main() {
  const args = process.argv.slice(2);
  const argLimite = args.find((a) => a.startsWith("--limite="));
  const argEstado = args.find((a) => a.startsWith("--estado="));
  const esTodos = args.includes("--todo");
  const soloBarrios = args.includes("--solo-barrios");
  const soloCalles = args.includes("--solo-calles");

  let limite = 100;
  if (argLimite) {
    limite = parseInt(argLimite.split("=")[1], 10) || 100;
  } else if (esTodos) {
    limite = 30000;
  }

  const filtroEstado = argEstado ? argEstado.split("=")[1].trim() : null;

  console.log("\n=======================================================");
  console.log("🗺️  SISTEMA DE CARGA Y GEOCODIFICACIÓN (ZÁRATE)");
  console.log("=======================================================\n");

  const whereClause: any = {
    domicilio: { not: null },
    OR: [{ latitud: null }, { longitud: null }],
  };

  if (filtroEstado) {
    whereClause.estado = {
      nombre: { equals: filtroEstado, mode: "insensitive" },
    };
    console.log(`📌 Filtrando solo por estado: "${filtroEstado}"`);
  }

  const totalPendientes = await prisma.usuario.count({ where: whereClause });
  console.log(`📊 Usuarios sin latitud/longitud pendientes: ${totalPendientes.toLocaleString()}`);

  if (totalPendientes === 0) {
    console.log("🎉 ¡Todos los usuarios ya tienen coordenadas asignadas!\n");
    return;
  }

  const usuarios = await prisma.usuario.findMany({
    where: whereClause,
    take: limite,
    include: {
      estado: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`🚀 Procesando lote actual de: ${usuarios.length} usuarios`);
  if (soloBarrios) console.log("🏘️  Modo: SOLO BARRIOS (rápido, sin peticiones de red)");
  if (soloCalles) console.log("🛣️  Modo: SOLO CALLES (con peticiones a OSM)");

  const cache = cargarCache();
  let exito = 0;
  let exitosBarrio = 0;
  let noEncontrados = 0;
  let desdeCache = 0;

  for (let i = 0; i < usuarios.length; i++) {
    const user = usuarios[i];
    const domOriginal = user.domicilio?.trim() || "";
    if (!domOriginal) continue;

    const infoDir = parsearDireccionZarate(domOriginal, user.ruta || undefined);
    let coords: { lat: number; lon: number } | null = null;

    // A. Si es un BARRIO reconocido -> Asignar directamente con jitter
    if (infoDir.esBarrio && infoDir.barrioKey) {
      if (soloCalles) continue;

      const barrioInfo = COORDENADAS_BARRIOS[infoDir.barrioKey];
      if (barrioInfo) {
        const jitter = generarJitter(user.id + "_" + user.nroUsuario, barrioInfo.radio);
        coords = {
          lat: barrioInfo.lat + jitter.latOffset,
          lon: barrioInfo.lon + jitter.lonOffset,
        };
        exitosBarrio++;
      }
    } else {
      // B. Si es una CALLE
      if (soloBarrios) continue;

      // 1. Buscar en caché solo para las consultas con NÚMERO
      for (const q of infoDir.consultasConNumero) {
        if (cache[q] !== undefined && cache[q] !== null) {
          coords = cache[q];
          desdeCache++;
          break;
        }
      }

      // 2. Si no estaba en caché, consultar a OpenStreetMap las direcciones con NÚMERO
      if (!coords && infoDir.consultasConNumero.length > 0) {
        for (const q of infoDir.consultasConNumero) {
          coords = await geocodificarDireccion(q);
          cache[q] = coords;
          guardarCache(cache);
          await new Promise((r) => setTimeout(r, 1000));
          if (coords) break;
        }
      }

      // 3. Fallback a la calle distribuyendo por altura
      if (!coords && infoDir.consultaCalleGeneral) {
        let calleCoords = cache[infoDir.consultaCalleGeneral];
        if (!calleCoords) {
          calleCoords = await geocodificarDireccion(infoDir.consultaCalleGeneral);
          if (calleCoords) {
            cache[infoDir.consultaCalleGeneral] = calleCoords;
            guardarCache(cache);
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (calleCoords) {
          const alturaNum = infoDir.altura || 100;
          const offset = ((alturaNum % 1000) - 500) * 0.000015;
          coords = {
            lat: calleCoords.lat + offset,
            lon: calleCoords.lon + offset * 0.6,
          };
        }
      }
    }

    if (coords) {
      const mapsUrl = `https://www.google.com/maps?q=${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`;
      await prisma.usuario.update({
        where: { id: user.id },
        data: {
          latitud: coords.lat,
          longitud: coords.lon,
          maps: mapsUrl,
        },
      });
      exito++;
      const etiqueta = infoDir.esBarrio ? `[BARRIO: ${infoDir.barrioKey}]` : "[CALLE]";
      process.stdout.write(
        `[${i + 1}/${usuarios.length}] ✅ #${user.nroUsuario} (${domOriginal}) ${etiqueta} -> Lat: ${coords.lat.toFixed(5)}, Lon: ${coords.lon.toFixed(5)}\n`
      );
    } else {
      noEncontrados++;
      process.stdout.write(
        `[${i + 1}/${usuarios.length}] ⚠️  #${user.nroUsuario} (${domOriginal}) -> No se encontró en Zárate\n`
      );
    }
  }

  console.log("\n=======================================================");
  console.log("🏁 LOTE COMPLETADO");
  console.log("=======================================================");
  console.log(`✅ Geocodificados con éxito: ${exito}`);
  console.log(`   - En Barrios (directo):   ${exitosBarrio}`);
  console.log(`   - Desde caché OSM:        ${desdeCache}`);
  console.log(`⚠️  No localizados:           ${noEncontrados}`);
  const restantes = await prisma.usuario.count({ where: whereClause });
  console.log(`📊 Restantes por geolocalizar: ${restantes.toLocaleString()}`);
  console.log("=======================================================\n");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Error en script de geocodificación:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
