/**
 * Normaliza y extrae la dirección base (calle y número principal) de un domicilio.
 * Ejemplos:
 * - "Mitre 302 PB" -> "mitre 302"
 * - "Mitre 302 Bis 2" -> "mitre 302"
 * - "Mitre 302 bis2" -> "mitre 302"
 * - "B.Mitre 686 2 C" -> "mitre 686"
 * - "9 de Julio 136 3 A" -> "9 de julio 136"
 * - "Gral. Pinto 1133 4 A" -> "gral pinto 1133"
 * - "Ituzaingo 665- Zonas comunes 2A" -> "ituzaingo 665"
 */
export function normalizarDireccionBase(dom: string | null | undefined): string {
  if (!dom) return "";
  let s = dom.trim().toLowerCase();

  // Eliminar acentos
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Reemplazar caracteres especiales y separadores por espacios
  s = s.replace(/[.,#\-\/\\_()]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Separar número pegado a bis (ej: "302bis" -> "302 bis", "302bis2" -> "302 bis2")
  s = s.replace(/(\d+)(bis\w*)/gi, "$1 $2");

  // Nombres de calles que inician con números o palabras compuestas
  const callesCompuestas = [
    "9 de julio",
    "25 de mayo",
    "3 de febrero",
    "12 de octubre",
    "1 de mayo",
    "pasaje",
  ];

  for (const c of callesCompuestas) {
    if (s.startsWith(c)) {
      const resto = s.slice(c.length).trim();
      const matchNum = resto.match(/^(\d{1,6})(?:\s+.*)?$/);
      if (matchNum) {
        return `${c} ${matchNum[1]}`.trim();
      }
      const matchCalleNum = resto.match(/^(\d+)\s+(\d{1,6})(?:\s+.*)?$/);
      if (matchCalleNum) {
        return `${c} ${matchCalleNum[1]} ${matchCalleNum[2]}`.trim();
      }
    }
  }

  // Abreviaturas y variaciones comunes
  s = s.replace(/\b(avda?\.?|avenida)\s+/g, "");
  s = s.replace(/\b(b\.?\s*mitre|bartolome\s+mitre)\b/g, "mitre");
  s = s.replace(/\bm\.?\s*paz\b/g, "maximo paz");
  s = s.replace(/\bh\.?\s*yrigoyen\b/g, "yrigoyen");
  s = s.replace(/\bj\.?\s*lima\b/g, "justa lima");
  s = s.replace(/\bj\.?\s*j\.?\s*paso\b/g, "juan jose paso");
  s = s.replace(/\br\.?\s*noya\b/g, "romulo noya");

  // Buscar: (nombre de calle) (número de puerta principal de 1 a 6 dígitos)
  const match = s.match(/^([a-z\s]+?)\s+(\d{1,6})(?:\s+.*)?$/i);
  if (match) {
    const calle = match[1].trim();
    const altura = match[2].trim();
    return `${calle} ${altura}`.trim();
  }

  return s;
}

/**
 * Determina si un usuario tiene activo el check de departamento / edificio.
 */
export function tieneCheckEdificio(u: {
  esDepartamento?: boolean | null;
  idEstadoDepto?: number | null;
  estadoDepto?: any;
}): boolean {
  return Boolean(u.esDepartamento || u.idEstadoDepto || u.estadoDepto);
}
