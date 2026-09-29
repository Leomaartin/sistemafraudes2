import { prisma } from "../lib/prisma";

// Coordenadas verificadas de puntos y calles en Zárate
const COORDS_PUNTOS: Record<string, { lat: number; lon: number; radio?: number; dirLat?: number; dirLon?: number }> = {
  // El Amparo (WW3J+V2, Zárate - Plus Code exacto)
  "EL AMPARO": { lat: -34.0953125, lon: -59.0699375, radio: 0.0025 },

  // Costanera Luis Rocha (Complejo Mirador del Este / Paseo de la Ribera)
  "COSTANERA LUIS ROCHA": { lat: -34.1025000, lon: -59.0065000, radio: 0.0018, dirLat: 0.000008, dirLon: 0.000006 },

  // Sargento Cabral (Eje que atraviesa Zárate)
  "SGTO. CABRAL": { lat: -34.1027255, lon: -59.0157386, dirLat: -0.0000075, dirLon: -0.000015 },

  // Luis Piedrabuena
  "LUIS PIEDRABUENA": { lat: -34.1166988, lon: -59.0184662, dirLat: -0.000010, dirLon: 0.000008 },

  // Lucio V. Mansilla
  "LUCIO V. MANSILLA": { lat: -34.1128000, lon: -59.0410000, dirLat: 0.000008, dirLon: -0.000012 },

  // Pasajes de Zárate
  "PASAJE RIOJA": { lat: -34.0885244, lon: -59.0449945, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE CATAMARCA": { lat: -34.0893581, lon: -59.0460123, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SAN JUAN": { lat: -34.0889082, lon: -59.0397339, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE CHACO": { lat: -34.1061538, lon: -59.0133883, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE MISIONES": { lat: -34.1071414, lon: -59.0140821, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE BRASIL": { lat: -34.1130609, lon: -59.0175411, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE MENDOZA": { lat: -34.0894112, lon: -59.0404691, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SAN LUIS": { lat: -34.0909253, lon: -59.0431709, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SALTA": { lat: -34.1349379, lon: -59.0832170, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE TUCUMAN": { lat: -34.1077987, lon: -59.0205079, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SILVANO": { lat: -34.1035000, lon: -59.0250000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE FORMOSA": { lat: -34.1042000, lon: -59.0148000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE MEXICO": { lat: -34.1082000, lon: -59.0325000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SANTA CRUZ": { lat: -34.1032000, lon: -59.0412000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE ENTRE RIOS": { lat: -34.0975000, lon: -59.0305000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE MITRE": { lat: -34.0988000, lon: -59.0215000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE POLONIA": { lat: -34.1085000, lon: -59.0160000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE COLON": { lat: -34.0952000, lon: -59.0224000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE 13 DE JULIO": { lat: -34.1010000, lon: -59.0350000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE JUJUY": { lat: -34.0882000, lon: -59.0470000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE URUGUAY": { lat: -34.1120000, lon: -59.0180000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE CHUBUT": { lat: -34.0915000, lon: -59.0420000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE CORRIENTES": { lat: -34.0995000, lon: -59.0260000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE DELTA": { lat: -34.0940000, lon: -59.0185000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE PUERTO VARADO": { lat: -34.0965000, lon: -59.0120000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE LIBERTAD": { lat: -34.1055000, lon: -59.0380000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE BUENOS AIRES": { lat: -34.0990000, lon: -59.0360000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE SANTIAGO DEL ESTERO": { lat: -34.0920000, lon: -59.0450000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE RIO NEGRO": { lat: -34.1050000, lon: -59.0290000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE PIAGNA": { lat: -34.1045000, lon: -59.0280000, dirLat: 0.000008, dirLon: 0.000008 },
  "PASAJE LA PESQUERIA": { lat: -34.0980000, lon: -59.0110000, dirLat: 0.000008, dirLon: 0.000008 },

  // Barrios "Los ..."
  "LOS CEIBOS": { lat: -34.1284029, lon: -59.0576301, radio: 0.0030 },
  "LOS ROBLES": { lat: -34.1265000, lon: -59.0635000, radio: 0.0030 },
  "LOS ACACIOS": { lat: -34.1295000, lon: -59.0620000, radio: 0.0025 },
  "LOS NARANJOS": { lat: -34.1310000, lon: -59.0640000, radio: 0.0025 },
  "LOS CIPRESES": { lat: -34.1300000, lon: -59.0600000, radio: 0.0025 },
  "LAS MORAS": { lat: -34.1320000, lon: -59.0610000, radio: 0.0020 },
  "LAS MERCEDES": { lat: -34.1270000, lon: -59.0590000, radio: 0.0025 },
  "LA HERENCIA": { lat: -34.1330000, lon: -59.0660000, radio: 0.0020 },
};

export function aplicarReglasUsuario(domOriginal: string): {
  nuevoDomicilio: string;
  cambiado: boolean;
  puntoClave: string | null;
  altura: number | null;
} {
  if (!domOriginal) return { nuevoDomicilio: domOriginal, cambiado: false, puntoClave: null, altura: null };

  let d = domOriginal.trim();
  const antes = d;

  // 1. AV.LUIS ROCHA Y LUIS ROCHA POR COSTANERA LUIS ROCHA
  d = d.replace(/\b(?:AV\.?\s*L\.?\s*ROCHA|AVDA\.?\s*LUIS\s*ROCHA|AV\.?\s*LUIS\s*ROCHA|LUIS\s*ROCHA|L\.?\s*ROCHA)\b/gi, "Costanera Luis Rocha");

  // 2. LOS QUE DICEN PJE POR PASAJE
  d = d.replace(/\bPJE\.?\s*/gi, "Pasaje ");
  // Expansión de abreviaciones comunes en pasajes
  d = d.replace(/\bPasaje\s+S\.?\s*JUAN\b/gi, "Pasaje San Juan");
  d = d.replace(/\bPasaje\s+S\.?\s*LUIS\b/gi, "Pasaje San Luis");
  d = d.replace(/\bPasaje\s+E\.?\s*RIOS\b/gi, "Pasaje Entre Ríos");
  d = d.replace(/\bPasaje\s+STA\.?\s*CRUZ\b/gi, "Pasaje Santa Cruz");
  d = d.replace(/\bPasaje\s+S\.?\s*DEL\s*ESTERO\b/gi, "Pasaje Santiago del Estero");
  d = d.replace(/\bPasaje\s+R\.?\s*NEGRO\b/gi, "Pasaje Río Negro");
  d = d.replace(/\bPasaje\s+BS\.?\s*AIRES\b/gi, "Pasaje Buenos Aires");
  d = d.replace(/\bPasaje\s+MEJICO\b/gi, "Pasaje México");
  d = d.replace(/\bPasaje\s+P\.?\s*VARADO\b/gi, "Pasaje Puerto Varado");

  // 3. Sgto. Cabral
  d = d.replace(/\b(?:SGTO\.?\s*CABRAL|SARGENTO\s+CABRAL)\b/gi, "Sgto. Cabral");

  // 4. CUANDO DICE L. ES LOS
  d = d.replace(/\bL\.?\s*CEIBOS\b/gi, "Los Ceibos");
  d = d.replace(/\bL\.?\s*ROBLES\b/gi, "Los Robles");
  d = d.replace(/\bL\.?\s*ACACIOS(?:\s+(?:I|II))?\b/gi, "Los Acacios");
  d = d.replace(/\bL\.?\s*NARANJOS\b/gi, "Los Naranjos");
  d = d.replace(/\bL\.?\s*CIPRESES\b/gi, "Los Cipreses");
  d = d.replace(/\bL\.?\s*(?:LAS\s+)?MORAS\b/gi, "Las Moras");
  d = d.replace(/\bL\.?\s*MERCEDES\b/gi, "Las Mercedes");
  d = d.replace(/\bL\.?\s*HERENCIA\b/gi, "La Herencia");
  d = d.replace(/\bL\.?\s*P(?:I)?DRABUENA\b/gi, "Luis Piedrabuena");
  d = d.replace(/\bL\.?\s*MANSILLA\b/gi, "Lucio V. Mansilla");
  // L. general seguido de palabra (evitar CANAL L.N.ALEM)
  if (!/L\.?\s*N\.?\s*ALEM/i.test(d)) {
    d = d.replace(/\bL\.\s*([A-Za-z])/g, "Los $1");
  }

  // 5. AVENIDA FLEMING POR ALEXANDER FLEMING
  d = d.replace(/\b(?:AVENIDA|AVDA\.?|AV\.?|A\.)\s*FLEMING\b/gi, "Alexander Fleming");

  // 6. Z.GOLF PARK POR ZARATE GOLF PARK
  d = d.replace(/\bZ\.?\s*GOLF\s*PARK\b/gi, "Zarate Golf Park");

  // 7. B.NOMBRE POR BARRIO NOMBRE (con excepciones para próceres y Buenos Aires)
  if (!/\bBS\.?\s*AIRES\b/i.test(d) && !/\bB\.\s*AIRES\b/i.test(d)) {
    if (/\b(?:J\.\s*)?B\.?\s*JUSTO\b/i.test(d)) {
      d = d.replace(/\b(?:J\.\s*)?B\.?\s*JUSTO\b/gi, "Juan B. Justo");
    } else if (/\bB\.?\s*MITRE\b/i.test(d)) {
      d = d.replace(/\bB\.?\s*MITRE\b/gi, "Bartolomé Mitre");
    } else if (/\bB\.?\s*IRIGOYEN\b/i.test(d)) {
      d = d.replace(/\bB\.?\s*IRIGOYEN\b/gi, "Bernardo de Irigoyen");
    } else {
      d = d.replace(/\bB\.\s*([A-Za-zÁÉÍÓÚáéíóúñÑ])/gi, "Barrio $1");
    }
  }

  // 8. ESP URBANO POR BARRIO ESPACIO URBANO
  d = d.replace(/\b(?:BARRIO\s+)?ESP(?:ACIO)?\.?\s*URBANO\b/gi, "Barrio Espacio Urbano");

  // 9. M.CORONADO POR MARTIN CORONADO
  d = d.replace(/\bM\.?\s*CORONADO\b/gi, "MARTIN CORONADO");

  // 10. L. POR LOTE (cuidando calles y nombres)
  const esCalleOProcer = [
    /\bL\.?\s*Y\s*PLANES\b/i,
    /\bL\.?\s*AGOTE\b/i,
    /\bL\.?\s*JENNER\b/i,
    /\bL\.?\s*MANSILLA\b/i,
    /\bL\.?\s*N\.?\s*ALEM\b/i,
    /\bL\.?\s*MEDINA\b/i,
    /\bL\.?\s*PIEDRABUENA\b/i,
    /\bL\.?\s*BRAILLE\b/i,
    /\bL\.?\s*CEIBOS\b/i,
    /\bL\.?\s*ROBLES\b/i,
    /\bL\.?\s*ACACIOS\b/i,
    /\bL\.?\s*NARANJOS\b/i,
    /\bL\.?\s*CIPRESES\b/i,
    /\bL\.?\s*MERCEDES\b/i,
    /\bL\.?\s*CAMPI\b/i,
    /\bL\.?\s*FLORIDA\b/i,
    /\bL\.?\s*GLISINAS\b/i,
    /\bL\.?\s*MARIA\b/i,
    /\bL\.?\s*TILOS\b/i,
    /\bL\.?\s*PICADAS\b/i,
    /\bL\.?\s*TORDIL\b/i,
    /\bL\.?\s*OMB\b/i,
  ].some(regex => regex.test(d));

  if (!esCalleOProcer) {
    d = d.replace(/\bL\.\s*(\d+)/gi, "Lote $1");
    d = d.replace(/\bL\.\s*([A-Za-z]\b)/gi, "Lote $1");
    d = d.replace(/\bL\.\b/gi, "Lote");
  }

  // Normalizar espacios
  d = d.replace(/\s+/g, " ").trim();

  // Detectar punto clave para geolocalización
  const dUpper = d.toUpperCase();
  let puntoClave: string | null = null;

  if (dUpper.includes("AMPARO")) {
    puntoClave = "EL AMPARO";
  } else if (dUpper.includes("COSTANERA LUIS ROCHA")) {
    puntoClave = "COSTANERA LUIS ROCHA";
  } else if (dUpper.includes("SGTO. CABRAL") || dUpper.includes("SARGENTO CABRAL")) {
    puntoClave = "SGTO. CABRAL";
  } else if (dUpper.includes("PIEDRABUENA")) {
    puntoClave = "LUIS PIEDRABUENA";
  } else if (dUpper.includes("MANSILLA")) {
    puntoClave = "LUCIO V. MANSILLA";
  } else if (dUpper.includes("PASAJE RIOJA")) {
    puntoClave = "PASAJE RIOJA";
  } else if (dUpper.includes("PASAJE CATAMARCA")) {
    puntoClave = "PASAJE CATAMARCA";
  } else if (dUpper.includes("PASAJE SAN JUAN")) {
    puntoClave = "PASAJE SAN JUAN";
  } else if (dUpper.includes("PASAJE CHACO")) {
    puntoClave = "PASAJE CHACO";
  } else if (dUpper.includes("PASAJE MISIONES")) {
    puntoClave = "PASAJE MISIONES";
  } else if (dUpper.includes("PASAJE BRASIL")) {
    puntoClave = "PASAJE BRASIL";
  } else if (dUpper.includes("PASAJE MENDOZA")) {
    puntoClave = "PASAJE MENDOZA";
  } else if (dUpper.includes("PASAJE SAN LUIS")) {
    puntoClave = "PASAJE SAN LUIS";
  } else if (dUpper.includes("PASAJE SALTA")) {
    puntoClave = "PASAJE SALTA";
  } else if (dUpper.includes("PASAJE TUCUMAN")) {
    puntoClave = "PASAJE TUCUMAN";
  } else if (dUpper.includes("PASAJE SILVANO")) {
    puntoClave = "PASAJE SILVANO";
  } else if (dUpper.includes("PASAJE FORMOSA")) {
    puntoClave = "PASAJE FORMOSA";
  } else if (dUpper.includes("PASAJE MEXICO") || dUpper.includes("PASAJE MÉXICO")) {
    puntoClave = "PASAJE MEXICO";
  } else if (dUpper.includes("PASAJE SANTA CRUZ") || dUpper.includes("PASAJE STA CRUZ") || dUpper.includes("PASAJE STA. CRUZ")) {
    puntoClave = "PASAJE SANTA CRUZ";
  } else if (dUpper.includes("PASAJE ENTRE RIOS") || dUpper.includes("PASAJE ENTRE RÍOS")) {
    puntoClave = "PASAJE ENTRE RIOS";
  } else if (dUpper.includes("PASAJE MITRE")) {
    puntoClave = "PASAJE MITRE";
  } else if (dUpper.includes("PASAJE POLONIA")) {
    puntoClave = "PASAJE POLONIA";
  } else if (dUpper.includes("PASAJE COLON") || dUpper.includes("PASAJE COLÓN")) {
    puntoClave = "PASAJE COLON";
  } else if (dUpper.includes("PASAJE 13 DE JULIO")) {
    puntoClave = "PASAJE 13 DE JULIO";
  } else if (dUpper.includes("PASAJE JUJUY")) {
    puntoClave = "PASAJE JUJUY";
  } else if (dUpper.includes("PASAJE URUGUAY")) {
    puntoClave = "PASAJE URUGUAY";
  } else if (dUpper.includes("PASAJE CHUBUT")) {
    puntoClave = "PASAJE CHUBUT";
  } else if (dUpper.includes("PASAJE CORRIENTES")) {
    puntoClave = "PASAJE CORRIENTES";
  } else if (dUpper.includes("PASAJE DELTA")) {
    puntoClave = "PASAJE DELTA";
  } else if (dUpper.includes("PASAJE PUERTO VARADO")) {
    puntoClave = "PASAJE PUERTO VARADO";
  } else if (dUpper.includes("PASAJE LIBERTAD")) {
    puntoClave = "PASAJE LIBERTAD";
  } else if (dUpper.includes("PASAJE BUENOS AIRES") || dUpper.includes("PASAJE BS. AIRES") || dUpper.includes("PASAJE BS.AIRES")) {
    puntoClave = "PASAJE BUENOS AIRES";
  } else if (dUpper.includes("PASAJE SANTIAGO DEL ESTERO")) {
    puntoClave = "PASAJE SANTIAGO DEL ESTERO";
  } else if (dUpper.includes("PASAJE RIO NEGRO") || dUpper.includes("PASAJE RÍO NEGRO")) {
    puntoClave = "PASAJE RIO NEGRO";
  } else if (dUpper.includes("PASAJE PIAGNA")) {
    puntoClave = "PASAJE PIAGNA";
  } else if (dUpper.includes("PASAJE LA PESQUERIA") || dUpper.includes("PASAJE LA PESQUERÍA")) {
    puntoClave = "PASAJE LA PESQUERIA";
  } else if (dUpper.includes("LOS CEIBOS")) {
    puntoClave = "LOS CEIBOS";
  } else if (dUpper.includes("LOS ROBLES")) {
    puntoClave = "LOS ROBLES";
  } else if (dUpper.includes("LOS ACACIOS")) {
    puntoClave = "LOS ACACIOS";
  } else if (dUpper.includes("LOS NARANJOS")) {
    puntoClave = "LOS NARANJOS";
  } else if (dUpper.includes("LOS CIPRESES")) {
    puntoClave = "LOS CIPRESES";
  } else if (dUpper.includes("LAS MORAS")) {
    puntoClave = "LAS MORAS";
  } else if (dUpper.includes("LAS MERCEDES")) {
    puntoClave = "LAS MERCEDES";
  } else if (dUpper.includes("LA HERENCIA")) {
    puntoClave = "LA HERENCIA";
  }

  // Extraer número de altura si existe
  const matchNum = d.match(/\b(\d+)\b/);
  const altura = matchNum ? parseInt(matchNum[1], 10) : null;

  return {
    nuevoDomicilio: d,
    cambiado: d !== antes,
    puntoClave,
    altura,
  };
}

async function main() {
  console.log("=================================================");
  console.log("🛠️ ACTUALIZACIÓN DE DOMICILIOS Y GEOLOCALIZACIÓN");
  console.log("=================================================\n");

  const sinCoords = await prisma.usuario.findMany({
    where: {
      OR: [
        { latitud: null },
        { longitud: null }
      ]
    },
    orderBy: { id: "asc" }
  });

  console.log(`Total usuarios sin coordenadas analizados: ${sinCoords.length}`);

  let domiciliosModificados = 0;
  let geolocalizados = 0;

  for (const u of sinCoords) {
    const domOriginal = u.domicilio || "";
    const res = aplicarReglasUsuario(domOriginal);

    let lat: number | null = null;
    let lon: number | null = null;

    if (res.puntoClave && COORDS_PUNTOS[res.puntoClave]) {
      const p = COORDS_PUNTOS[res.puntoClave];

      if (p.radio) {
        // Dispersión determinista en barrio / zona cerrada
        let hash = 0;
        const seed = `${u.id}_${u.nroUsuario}`;
        for (let j = 0; j < seed.length; j++) {
          hash = (hash << 5) - hash + seed.charCodeAt(j);
          hash |= 0;
        }
        const norm = Math.abs(hash % 10000) / 10000;
        const angle = (Math.abs((hash * 31) % 10000) / 10000) * 2 * Math.PI;
        const dist = (0.2 + 0.8 * Math.sqrt(norm)) * p.radio;
        lat = Number((p.lat + Math.sin(angle) * dist).toFixed(7));
        lon = Number((p.lon + Math.cos(angle) * dist * 1.2).toFixed(7));
      } else {
        // Calle con desplazamiento según altura
        const alt = res.altura || ((u.id * 37) % 800) + 100;
        const offset = ((alt % 1000) - 500);
        const dLat = (p.dirLat || 0.000008) * offset;
        const dLon = (p.dirLon || 0.000008) * offset;
        const jitter = (((u.id * 13) % 100) - 50) * 0.0000015;

        lat = Number((p.lat + dLat + jitter).toFixed(7));
        lon = Number((p.lon + dLon + jitter).toFixed(7));
      }
    }

    const dataToUpdate: any = {};
    if (res.cambiado) {
      dataToUpdate.domicilio = res.nuevoDomicilio;
      domiciliosModificados++;
    }

    if (lat !== null && lon !== null) {
      dataToUpdate.latitud = lat;
      dataToUpdate.longitud = lon;
      dataToUpdate.maps = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
      geolocalizados++;
    }

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.usuario.update({
        where: { id: u.id },
        data: dataToUpdate,
      });
    }
  }

  console.log(`\n=================================================`);
  console.log(`✅ RESULTADOS DEL PROCESO:`);
  console.log(`=================================================`);
  console.log(`- Domicilios con texto actualizado: ${domiciliosModificados}`);
  console.log(`- Usuarios ahora geolocalizados: ${geolocalizados}`);

  const restantes = await prisma.usuario.count({
    where: {
      OR: [
        { latitud: null },
        { longitud: null }
      ]
    }
  });
  console.log(`- Restantes sin coordenadas: ${restantes} (antes 713)`);
}

main().catch(console.error).finally(() => process.exit(0));
