/**
 * Calles de próceres o nombres urbanos clásicos que inician con B. o M. y NO son barrios
 */
const CALLES_URBANAS_NO_BARRIO = [
  "mitre",
  "irigoyen",
  "yrigoyen",
  "roldan",
  "de la torre",
  "paz", // Maximo Paz
  "conesa",
  "castelli",
  "brown",
  "noya",
  "lima",
  "alem",
  "belgrano",
  "san martin",
  "moreno",
  "ituzaingo",
  "lavalle",
  "rivadavia",
  "independencia",
  "saravi",
  "guemes",
  "arellano",
];

/**
 * Determina si una dirección corresponde a un barrio abierto/cerrado, loteo,
 * manzana, quinta, chacra o kilómetro sobre ruta, los cuales NUNCA deben
 * considerarse edificios de departamentos acumulados.
 */
export function esBarrioOLoteo(domicilio?: string | null): boolean {
  if (!domicilio) return false;
  const s = domicilio.trim().toLowerCase();

  // Excluir calles urbanas clásicas abreviadas con B. o M. (ej: "B.Mitre 686", "M.Paz 545")
  for (const c of CALLES_URBANAS_NO_BARRIO) {
    if (new RegExp(`^[bm]\\.?\\s*${c}\\b`, "i").test(s)) {
      // Es una calle urbana tradicional, solo es loteo si tiene "lote" o "manzana" explícito
      if (!/\b(lote|lt|manzana|mza|mz)\s*\d+/i.test(s)) {
        return false;
      }
    }
  }

  // 1. Barrio explícito ("Barrio La Florida", "B° Los Ceibos", "Bo. Las Acacias")
  if (/\b(barrio|b°|bo\.)\s+[a-z]/i.test(s)) return true;

  // 2. Nombres de barrios conocidos y loteos de Zárate
  const barriosConocidos = [
    "la florida",
    "florida",
    "victoria",
    "las marias",
    "marias",
    "las mariñas",
    "mariñas",
    "los ceibos",
    "ceibos",
    "los robles",
    "robles",
    "los naranjos",
    "naranjos",
    "los mirtillos",
    "mirtillos",
    "las acacias",
    "acacias",
    "la campiña",
    "campiña",
    "las picadas",
    "picadas",
    "las casuarinas",
    "casuarinas",
    "aldea suiza",
    "smithfield",
    "la candelaria",
    "candelaria",
    "el rincon",
    "la carona",
    "carona",
    "el cabure",
    "san jacinto",
    "san miguel",
    "el mirador",
    "los pinos",
    "sauces",
    "parque de las rosas",
    "fincas de la florida",
    "chacras de la florida",
  ];

  for (const b of barriosConocidos) {
    if (s.includes(b)) return true;
  }

  // 3. Lote o Manzana explícitos ("Lote 3", "Lt 14", "L. 5", "Mz 2", "Mza 10", "Manzana 1")
  if (/\b(lote|lt|l\.)\s*\d+/i.test(s)) return true;
  if (/\b(manzana|mza|mz|m\.)\s*\d+/i.test(s)) return true;

  // 4. Parcela, Chacra, Quinta, Finca
  if (/\b(parcela|chacra|quinta|finca)\s*(\d+|[a-z])/i.test(s)) return true;

  // 5. Rutas, kilómetros y parajes rurales (inmuebles sobre ruta)
  if (/\b(km|kilometro|km\.)\s*\d+/i.test(s)) return true;
  if (/\bruta\s*\d+/i.test(s)) return true;
  if (/\b(cuartel|colectora|paraje|isla)\b/i.test(s)) return true;

  return false;
}

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
 *
 * NOTA: Para barrios, lotes, quintas y rutas (ej: "Barrio La Florida Lote 3") retorna ""
 * para evitar agrupar indebidamente casas y parcelas en edificios falsos.
 */
export function normalizarDireccionBase(dom: string | null | undefined): string {
  if (!dom) return "";

  // Si es un barrio, loteo, quinta o ruta, cada parcela es independiente
  if (esBarrioOLoteo(dom)) {
    return "";
  }

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

  // Calles numeradas ("calle 10 109", "pje 2 45")
  const matchCalleNum = s.match(/^(calle|c|pje|pasaje)\s+(\d{1,4})(?:\s+(\d{1,6}))(?:\s+.*)?$/i);
  if (matchCalleNum) {
    const tipo = matchCalleNum[1];
    const numCalle = matchCalleNum[2];
    const altura = matchCalleNum[3];
    return `${tipo} ${numCalle} ${altura}`.trim();
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
