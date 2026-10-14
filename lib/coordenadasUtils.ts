/**
 * Utilidades para conversión, análisis y formateo de coordenadas geográficas
 * Soporta Grados Decimales (DD) y Grados, Minutos y Segundos (DMS / GMS)
 * Ejemplos:
 *   - DMS: 34°05'22.6"S 59°01'56.3"W
 *   - Decimal: -34.089610, -59.032298
 */

export type DireccionLat = "S" | "N";
export type DireccionLng = "W" | "O" | "E";

export interface DMSComponentes {
  grados: number;
  minutos: number;
  segundos: number;
  direccion: "N" | "S" | "E" | "W" | "O";
}

export interface ResultadoParseoCoordenadas {
  lat: number;
  lng: number;
  formatoDetectado: "decimal" | "dms" | "url_maps";
  dmsLat?: DMSComponentes;
  dmsLng?: DMSComponentes;
}

/**
 * Convierte componentes de Grados, Minutos y Segundos a Grados Decimales
 */
export function dmsToDecimal(
  grados: number,
  minutos: number,
  segundos: number,
  direccion: "N" | "S" | "E" | "W" | "O"
): number {
  const g = Math.abs(grados || 0);
  const m = Math.abs(minutos || 0);
  const s = Math.abs(segundos || 0);

  let dec = g + m / 60 + s / 3600;
  const dirUpper = direccion.toUpperCase();

  if (dirUpper === "S" || dirUpper === "W" || dirUpper === "O") {
    dec = -dec;
  }

  return Number(dec.toFixed(6));
}

/**
 * Convierte Grados Decimales a Grados, Minutos y Segundos con formateo legible
 */
export function decimalToDms(
  decimal: number,
  esLatitud: boolean
): {
  grados: number;
  minutos: number;
  segundos: number;
  direccion: string;
  formatted: string;
} {
  const absVal = Math.abs(decimal);
  const grados = Math.floor(absVal);
  const minutosDecimal = (absVal - grados) * 60;
  const minutos = Math.floor(minutosDecimal);
  const segundos = Number(((minutosDecimal - minutos) * 60).toFixed(1));

  let direccion = "";
  if (esLatitud) {
    direccion = decimal < 0 ? "S" : "N";
  } else {
    direccion = decimal < 0 ? "W" : "E";
  }

  const mm = String(minutos).padStart(2, "0");
  const ss = segundos < 10 ? `0${segundos.toFixed(1)}` : segundos.toFixed(1);
  const formatted = `${grados}°${mm}'${ss}"${direccion}`;

  return {
    grados,
    minutos,
    segundos,
    direccion,
    formatted,
  };
}

/**
 * Devuelve el par de coordenadas formateadas en DMS estándar (ej: 34°05'22.6"S 59°01'56.3"W)
 */
export function formatearDmsCompleto(lat: number, lng: number): string {
  const dmsLat = decimalToDms(lat, true);
  const dmsLng = decimalToDms(lng, false);
  return `${dmsLat.formatted} ${dmsLng.formatted}`;
}

/**
 * Parsea un fragmento individual en DMS (ej: 34°05'22.6"S o 59°01'56.3"W)
 */
function parsearParteDMS(
  texto: string,
  esLatitud: boolean
): DMSComponentes | null {
  const regex =
    /([NSWEOnsweo])?\s*(\d{1,3})\s*(?:[°\s_dDº])\s*(\d{1,2})\s*(?:['\s_mM′’])\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["\s_sS″”]?)\s*([NSWEOnsweo])?/i;

  const match = texto.match(regex);
  if (!match) return null;

  const dirPrefix = match[1];
  const g = parseInt(match[2], 10);
  const m = parseInt(match[3], 10);
  const s = parseFloat(match[4].replace(",", "."));
  const dirSuffix = match[5];

  let rawDir = (dirSuffix || dirPrefix || "").toUpperCase();
  if (!rawDir) {
    rawDir = esLatitud ? "S" : "W"; // Zárate / Argentina por defecto
  }

  return {
    grados: g,
    minutos: m,
    segundos: s,
    direccion: rawDir as any,
  };
}

/**
 * Analiza un texto ingresado por el usuario en cualquier formato:
 * 1. URLs de Google Maps (@-34.089610,-59.032298 o q=-34.089610,-59.032298)
 * 2. DMS completo: 34°05'22.6"S 59°01'56.3"W
 * 3. Decimales: -34.089610, -59.032298
 */
export function parsearCoordenadas(
  input: string
): ResultadoParseoCoordenadas | null {
  if (!input || typeof input !== "string") return null;
  const texto = input.trim();

  // 1. Detección en URLs de Google Maps
  const urlRegex = /(?:@|[?&]q=)(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/;
  const urlMatch = texto.match(urlRegex);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        formatoDetectado: "url_maps",
      };
    }
  }

  // 2. Detección DMS (ej: 34°05'22.6"S 59°01'56.3"W)
  // Puede estar separado por espacio, coma o salto de línea
  const partesDmsRegex =
    /((?:[NSns]\s*)?\d{1,2}\s*[°º\s_dD]\s*\d{1,2}\s*['′’\s_mM]\s*\d{1,2}(?:[.,]\d+)?\s*["″”\s_sS]?(?:\s*[NSns])?)[\s,;|]+((?:[EWOewos]\s*)?\d{1,3}\s*[°º\s_dD]\s*\d{1,2}\s*['′’\s_mM]\s*\d{1,2}(?:[.,]\d+)?\s*["″”\s_sS]?(?:\s*[EWOewos])?)/i;

  const dmsMatch = texto.match(partesDmsRegex);
  if (dmsMatch) {
    const compLat = parsearParteDMS(dmsMatch[1], true);
    const compLng = parsearParteDMS(dmsMatch[2], false);

    if (compLat && compLng) {
      const lat = dmsToDecimal(
        compLat.grados,
        compLat.minutos,
        compLat.segundos,
        compLat.direccion
      );
      const lng = dmsToDecimal(
        compLng.grados,
        compLng.minutos,
        compLng.segundos,
        compLng.direccion
      );

      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return {
          lat,
          lng,
          formatoDetectado: "dms",
          dmsLat: compLat,
          dmsLng: compLng,
        };
      }
    }
  }

  // 3. Detección Decimal estándar: -34.089610, -59.032298 o -34.089610 -59.032298
  const decRegex =
    /^(-?\d{1,2}(?:[.,]\d+)?)[,\s;|]+(-?\d{1,3}(?:[.,]\d+)?)$/;
  const decMatch = texto.match(decRegex);
  if (decMatch) {
    const lat = parseFloat(decMatch[1].replace(",", "."));
    const lng = parseFloat(decMatch[2].replace(",", "."));

    if (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        formatoDetectado: "decimal",
      };
    }
  }

  return null;
}
