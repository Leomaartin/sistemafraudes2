/**
 * Lista oficial de las 30 tarifas permitidas del sistema.
 */
export const TARIFAS_OFICIALES: readonly string[] = [
  "T1RN1",
  "T1R-N2",
  "1G-I",
  "G1-N1",
  "G1-N2",
  "G1-N3",
  "IO",
  "RN1",
  "n2",
  "T1G",
  "T1G-D",
  "T1G-EBP",
  "T1G-G",
  "T1G-I",
  "T1R",
  "T1R-G1",
  "T1R-G1-N1",
  "T1R-G1-N2",
  "T1R-G1-N3",
  "T1R-G2-N2",
  "T1R-I",
  "T1R-N1",
  "T1RN-3",
  "T1R-N3",
  "T1R-P",
  "T4NR",
  "TASO",
  "TI1R",
  "TSED",
  "TS-G1-C1",
] as const;

export const TARIFAS_OFICIALES_SET = new Set<string>(TARIFAS_OFICIALES);

/**
 * Encuentra la tarifa oficial más parecida / similar para cualquier texto ingresado o importado.
 */
export function encontrarTarifaMasSimilar(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === "-" || t.toLowerCase() === "sin tarifa") return null;

  // 1. Coincidencia exacta (case-sensitive)
  if (TARIFAS_OFICIALES_SET.has(t)) return t;

  // 2. Coincidencia insensible a mayúsculas/minúsculas
  for (const oficial of TARIFAS_OFICIALES) {
    if (oficial.toLowerCase() === t.toLowerCase()) {
      return oficial;
    }
  }

  // 3. Normalizaciones de formatos comunes en planillas
  const upper = t.toUpperCase().replace(/\s+/g, " ");

  if (upper === "T1GI") return "T1G-I";
  if (upper === "I0") return "IO";
  if (upper === "T4RN1" || upper === "T4R") return "T4NR";
  if (upper === "1RN1") return "T1RN1";
  if (upper === "1RN3" || upper === "T1RN3") return "T1RN-3";
  if (upper === "TIR") return "T1R";
  if (upper === "TR1R-N1") return "T1R-N1";

  if (upper.startsWith("T1R-G1-N1")) return "T1R-G1-N1";
  if (upper.startsWith("T1R-N2")) return "T1R-N2";
  if (upper.startsWith("T1RN1 - G2- N2")) return "T1R-G2-N2";
  if (upper.startsWith("T1RN1")) return "T1RN1";
  if (upper.startsWith("T1R-G1-N")) return "T1R-G1-N1";

  // 4. Búsqueda por eliminación de guiones y símbolos
  const tClean = upper.replace(/[^A-Z0-9]/g, "");
  for (const oficial of TARIFAS_OFICIALES) {
    const oClean = oficial.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (tClean === oClean) {
      return oficial;
    }
  }

  // 5. Patrones T1G
  if (upper.includes("T1G") && upper.includes("I")) return "T1G-I";
  if (upper.includes("T1G") && upper.includes("D")) return "T1G-D";
  if (upper.includes("T1G") && upper.includes("G")) return "T1G-G";
  if (upper.includes("T1G")) return "T1G";

  // 6. Patrones T1R
  if (upper.includes("T1R") && upper.includes("N1")) return "T1R-N1";
  if (upper.includes("T1R") && upper.includes("N2")) return "T1R-N2";
  if (upper.includes("T1R") && upper.includes("N3")) return "T1R-N3";
  if (upper.includes("T1R")) return "T1R";

  return null;
}
