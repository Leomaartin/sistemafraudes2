/**
 * Configuración de colores y estados para el mapa de fraudes de Zárate.
 * Especificación de colores solicitada:
 * - RETIRADO / RETIRADO FRAUDE: Color piel (#e29578)
 * - BAJA / BAJA FRAUDE: Rojo (#ef4444)
 * - PAGOS A CUENTA / PAGOS A CUENTA FRAUDE: Naranja (#f97316)
 * - TIEMPO: Gris (#64748b)
 * - NOTIFICADO / SUSPENDIDO: Amarillo (#eab308)
 * - RECONECTADO / RECONECTADO FRAUDE: Celeste (#0ea5e9)
 * - GERENCIA: Violeta (#8b5cf6) con emoji de importante (⚠️)
 */

export interface EstadoColorDef {
  key: string;
  nombre: string;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  colorName: string; // "piel", "rojo", "naranja", "gris", "amarillo", "celeste", "violeta"
  emoji?: string;
  ids: number[];
}

export const ESTADOS_MAPA_CONFIG: EstadoColorDef[] = [
  {
    key: "notificado",
    nombre: "NOTIFICADO",
    colorName: "Amarillo",
    bg: "#eab308", // Amarillo vibrante
    text: "#713f12", // Texto marrón oscuro para máximo contraste
    border: "#ca8a04",
    badgeBg: "#fef9c3",
    badgeText: "#854d0e",
    dotColor: "#eab308",
    ids: [1],
  },
  {
    key: "suspendido",
    nombre: "SUSPENDIDO",
    colorName: "Amarillo",
    bg: "#eab308",
    text: "#713f12",
    border: "#ca8a04",
    badgeBg: "#fef9c3",
    badgeText: "#854d0e",
    dotColor: "#eab308",
    ids: [2],
  },
  {
    key: "fraude",
    nombre: "FRAUDE",
    colorName: "Rojo",
    bg: "#ef4444",
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [3],
  },
  {
    key: "reconectado",
    nombre: "RECONECTADO",
    colorName: "Celeste",
    bg: "#0ea5e9", // Celeste / Sky
    text: "#ffffff",
    border: "#0284c7",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    dotColor: "#0ea5e9",
    ids: [4],
  },
  {
    key: "reconectado_fraude",
    nombre: "RECONECTADO / FRAUDE",
    colorName: "Celeste",
    bg: "#0ea5e9",
    text: "#ffffff",
    border: "#0284c7",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    dotColor: "#0ea5e9",
    ids: [5],
  },
  {
    key: "retirado",
    nombre: "RETIRADO",
    colorName: "Color Piel",
    bg: "#e29578", // Color piel / peach cálido
    text: "#2b1810", // Texto café para lectura óptima
    border: "#c57b57",
    badgeBg: "#faedcd",
    badgeText: "#6b3e26",
    dotColor: "#e29578",
    ids: [6],
  },
  {
    key: "retirado_fraude",
    nombre: "RETIRADO / FRAUDE",
    colorName: "Color Piel",
    bg: "#e29578",
    text: "#2b1810",
    border: "#c57b57",
    badgeBg: "#faedcd",
    badgeText: "#6b3e26",
    dotColor: "#e29578",
    ids: [7],
  },
  {
    key: "baja",
    nombre: "BAJA",
    colorName: "Rojo",
    bg: "#ef4444", // Rojo
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [8],
  },
  {
    key: "baja_fraude",
    nombre: "BAJA / FRAUDE",
    colorName: "Rojo",
    bg: "#ef4444",
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [9],
  },
  {
    key: "pagos_cuenta",
    nombre: "PAGOS A CUENTA",
    colorName: "Naranja",
    bg: "#f97316", // Naranja
    text: "#ffffff",
    border: "#c2410c",
    badgeBg: "#ffedd5",
    badgeText: "#c2410c",
    dotColor: "#f97316",
    ids: [10],
  },
  {
    key: "pagos_cuenta_fraude",
    nombre: "PAGOS A CUENTA / FRAUDE",
    colorName: "Naranja",
    bg: "#f97316",
    text: "#ffffff",
    border: "#c2410c",
    badgeBg: "#ffedd5",
    badgeText: "#c2410c",
    dotColor: "#f97316",
    ids: [11],
  },
  {
    key: "tiempo",
    nombre: "TIEMPO",
    colorName: "Gris",
    bg: "#64748b", // Gris pizarra
    text: "#ffffff",
    border: "#475569",
    badgeBg: "#f1f5f9",
    badgeText: "#334155",
    dotColor: "#64748b",
    ids: [12],
  },
  {
    key: "gerencia",
    nombre: "GERENCIA",
    colorName: "Violeta",
    bg: "#8b5cf6", // Violeta
    text: "#ffffff",
    border: "#6d28d9",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
    dotColor: "#8b5cf6",
    emoji: "⚠️", // Emoji de importante solicitado
    ids: [13],
  },
];

/**
 * Obtiene la configuración de color exacta para un estado dado por id o nombre.
 */
export function obtenerConfigEstadoPorUsuario(estado?: { id?: number; nombre?: string } | null): EstadoColorDef {
  if (!estado) {
    return {
      key: "sin_estado",
      nombre: "SIN ESTADO",
      colorName: "Gris",
      bg: "#64748b",
      text: "#ffffff",
      border: "#475569",
      badgeBg: "#f1f5f9",
      badgeText: "#334155",
      dotColor: "#64748b",
      ids: [],
    };
  }

  const id = estado.id;
  const nombre = (estado.nombre || "").trim().toUpperCase();

  // Coincidencia por ID primero
  if (id) {
    const porId = ESTADOS_MAPA_CONFIG.find((e) => e.ids.includes(id));
    if (porId) return porId;
  }

  // Coincidencia por nombre
  const porNombre = ESTADOS_MAPA_CONFIG.find((e) => {
    const eNom = e.nombre.toUpperCase();
    return nombre === eNom || nombre.includes(eNom) || eNom.includes(nombre);
  });
  if (porNombre) return porNombre;

  // Si es un estado de llaves / departamento
  if (id && [14, 15, 16, 17].includes(id)) {
    return {
      key: "depto",
      nombre: estado.nombre || "DEPARTAMENTO",
      colorName: "Índigo",
      bg: "#6366f1",
      text: "#ffffff",
      border: "#4338ca",
      badgeBg: "#e0e7ff",
      badgeText: "#3730a3",
      dotColor: "#6366f1",
      emoji: "🏢",
      ids: [14, 15, 16, 17],
    };
  }

  // Fallback por defecto rojo
  return {
    key: "otro",
    nombre: estado.nombre || "OTRO",
    colorName: "Rojo",
    bg: "#ef4444",
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [],
  };
}
