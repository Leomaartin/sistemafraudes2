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
  s = s.replace(/[.,#\-\/\\_()°]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Separar número pegado a bis (ej: "302bis" -> "302 bis", "302bis2" -> "302 bis2")
  s = s.replace(/(\d+)(bis\w*)/gi, "$1 $2");

  // Limpiar prefijos de número ("nro", "n°", "n", "num") antes de un dígito
  s = s.replace(/\b(nro|num|numero|n)\s+(\d+)/gi, "$2");

  // Nombres de calles que inician con números o palabras compuestas (fechas patrias)
  const callesCompuestas = [
    "9 de julio",
    "25 de mayo",
    "3 de febrero",
    "12 de octubre",
    "1 de mayo",
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
      return `${c}`;
    }
  }

  // Abreviaturas y variaciones comunes
  s = s.replace(/\b(avda?|avenida)\s+/g, "");
  s = s.replace(/\b(b\s*mitre|bartolome\s+mitre)\b/g, "mitre");
  s = s.replace(/\b(m\s*paz|maximo\s+paz)\b/g, "maximo paz");
  s = s.replace(/\b(h\s*|hipolito\s+)?(yrigoyen|irigoyen)\b/g, "yrigoyen");
  s = s.replace(/\b(j\s*lima|justa\s+lima)\b/g, "justa lima");
  s = s.replace(/\b(j\s*j\s*paso|juan\s+jose\s+paso)\b/g, "juan jose paso");
  s = s.replace(/\b(r\s*noya|romulo\s+noya)\b/g, "romulo noya");

  // Calles numeradas ("calle 10 109", "ruta 9 km 87", "ruta 9 1234")
  const matchCalleNum = s.match(/^(calle|c|ruta|pje|pasaje)\s+(\d{1,4})(?:\s+km\s*(\d{1,4}))?(?:\s+(\d{1,6}))?(?:\s+.*)?$/i);
  if (matchCalleNum) {
    const tipo = matchCalleNum[1];
    const numCalle = matchCalleNum[2];
    const km = matchCalleNum[3];
    const altura = matchCalleNum[4];

    if (km) {
      return `${tipo} ${numCalle} km ${km}`.trim();
    }
    if (altura) {
      return `${tipo} ${numCalle} ${altura}`.trim();
    }
    // Si no tiene altura específica, no puede agrupar como edificio
    return "";
  }

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
