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

export function normalizarFechaDdMmYyyy(fechaStr?: string): string {
  if (!fechaStr || !fechaStr.trim()) return obtenerFechaActualFormateada();
  const m = fechaStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return fechaStr.trim();
  const dia = m[1].padStart(2, "0");
  const mes = m[2].padStart(2, "0");
  let anio = m[3];
  if (anio.length === 2) {
    const num = parseInt(anio, 10);
    anio = num >= 50 ? `19${anio}` : `20${anio}`;
  }
  return `${dia}/${mes}/${anio}`;
}

export function formatearAFechaInput(fechaStr?: string): string {
  if (!fechaStr) return "";
  const norm = normalizarFechaDdMmYyyy(fechaStr);
  const m = norm.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [_, dia, mes, anio] = m;
  return `${anio}-${mes}-${dia}`;
}

export function formatearDesdeFechaInput(isoStr?: string): string {
  if (!isoStr || !isoStr.trim()) return obtenerFechaActualFormateada();
  const partes = isoStr.trim().split("-");
  if (partes.length !== 3) return obtenerFechaActualFormateada();
  const [anio, mes, dia] = partes;
  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${anio}`;
}

/**
 * Parsea el texto guardado en la base de datos a una lista de observaciones estructuradas.
 * Conserva fielmente la fecha original de cada observación.
 */
export function parsearObservaciones(textoBruto?: string | null): ObservacionItem[] {
  if (!textoBruto || !textoBruto.trim()) {
    return [];
  }

  const lineas = textoBruto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ObservacionItem[] = [];

  for (let i = 0; i < lineas.length; i++) {
    let linea = lineas[i];
    // Quitar prefijo "observacion [número]: " si existe
    linea = linea.replace(/^observaci[oó]n\s*\d*\s*:\s*/i, "").trim();

    let texto = linea;
    let fecha = "";

    // 1. Detectar fecha al final: "texto - 24/09/2026" o "texto (24/09/2026)"
    const matchFinal = linea.match(/^(.*?)(?:\s*[-–—]\s*|\s*\(|\s+)(\d{1,2}\/\d{1,2}\/\d{2,4})\)?$/);
    if (matchFinal) {
      texto = matchFinal[1].trim();
      fecha = normalizarFechaDdMmYyyy(matchFinal[2]);
    } else {
      // 2. Detectar fecha al inicio: "10/07/2025 texto" o "10/07/2025 - texto"
      const matchInicio = linea.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:[-–—:]\s*)?(.*)$/);
      if (matchInicio) {
        fecha = normalizarFechaDdMmYyyy(matchInicio[1]);
        texto = matchInicio[2].trim();
      } else {
        // 3. Buscar cualquier fecha suelta en la línea
        const matchCualquiera = linea.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
        if (matchCualquiera) {
          fecha = normalizarFechaDdMmYyyy(matchCualquiera[1]);
        }
      }
    }

    // Si no tiene fecha detectable, se le asigna la fecha actual (de creación)
    if (!fecha) {
      fecha = obtenerFechaActualFormateada();
    }

    if (texto) {
      items.push({
        id: `obs-${i + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        texto,
        fecha,
      });
    }
  }

  return items;
}

/**
 * Convierte el array de observaciones al formato requerido para la base de datos:
 * "observacion 1: la observacion - 24/09/2026"
 * "observacion 2: la observacion - 15/05/2025"
 * La fecha queda guardada para siempre en la base de datos junto a la observación.
 */
export function formatearObservacionesParaGuardar(
  items: { texto: string; fecha?: string }[]
): string | null {
  const validas = items
    .map((item) => ({
      texto: item.texto.trim(),
      fecha: normalizarFechaDdMmYyyy(item.fecha),
    }))
    .filter((item) => item.texto.length > 0);

  if (validas.length === 0) {
    return null;
  }

  return validas
    .map((item, index) => `observacion ${index + 1}: ${item.texto} - ${item.fecha}`)
    .join("\n");
}
