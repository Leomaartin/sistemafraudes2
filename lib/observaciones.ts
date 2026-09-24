export interface ObservacionItem {
  id: string;
  texto: string;
  fecha: string;
}

export function obtenerFechaActualFormateada(): string {
  const ahora = new Date();
  const dia = String(ahora.getDate()).padStart(2, "0");
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const anio = ahora.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Parsea el texto guardado en la base de datos a una lista de observaciones estructuradas.
 * Admite formatos como:
 * "observacion 1: texto - 24/09/2026"
 * "observacion1: texto - 24/09/2026"
 * "Observación 1: texto (24/09/2026)"
 * o texto plano legado.
 */
export function parsearObservaciones(textoBruto?: string | null): ObservacionItem[] {
  if (!textoBruto || !textoBruto.trim()) {
    return [];
  }

  const lineas = textoBruto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fechaHoy = obtenerFechaActualFormateada();

  const items: ObservacionItem[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    // Regex para detectar: observacion [número]: [texto] - [fecha] o [texto] [fecha]
    const matchCompleto = linea.match(/^(?:observaci[oó]n\s*\d*\s*:\s*)?(.*?)(?:\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})|\s*\((\d{1,2}\/\d{1,2}\/\d{2,4})\))?$/i);

    if (matchCompleto) {
      let texto = (matchCompleto[1] || "").trim();
      let fecha = matchCompleto[2] || matchCompleto[3] || "";

      // Si no capturó fecha, vemos si la fecha está al final como dd/mm/aaaa
      if (!fecha) {
        const fechaAlFinal = texto.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b$/);
        if (fechaAlFinal) {
          fecha = fechaAlFinal[1];
          texto = texto.replace(/\s*[-–—]?\s*\b\d{1,2}\/\d{1,2}\/\d{2,4}\b$/, "").trim();
        }
      }

      // Si sigue sin fecha, usamos fecha actual
      if (!fecha) {
        fecha = fechaHoy;
      }

      // Quitar prefijo residual si quedara
      texto = texto.replace(/^observaci[oó]n\s*\d*\s*:\s*/i, "").trim();

      if (texto) {
        items.push({
          id: `obs-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          texto,
          fecha,
        });
      }
    } else {
      items.push({
        id: `obs-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        texto: linea,
        fecha: fechaHoy,
      });
    }
  }

  return items;
}

/**
 * Convierte el array de observaciones al formato requerido:
 * "observacion 1: la observacion - 24/09/2026"
 * "observacion 2: la observacion - 24/09/2026"
 */
export function formatearObservacionesParaGuardar(
  items: { texto: string; fecha?: string }[]
): string | null {
  const validas = items
    .map((item) => ({
      texto: item.texto.trim(),
      fecha: item.fecha?.trim() || obtenerFechaActualFormateada(),
    }))
    .filter((item) => item.texto.length > 0);

  if (validas.length === 0) {
    return null;
  }

  return validas
    .map((item, index) => `observacion ${index + 1}: ${item.texto} - ${item.fecha}`)
    .join("\n");
}
