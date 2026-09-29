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
  ids?: number[];
}

export const ESTADOS_MAPA_CONFIG: EstadoColorDef[] = [
  {
    key: "corte",
    nombre: "CORTE",
    colorName: "Rojo",
    bg: "#ef4444", // Rojo
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [16],
  },
  {
    key: "corte_fraude",
    nombre: "CORTE / FRAUDE",
    colorName: "Rojo",
    bg: "#ef4444", // Rojo
    text: "#ffffff",
    border: "#b91c1c",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    dotColor: "#ef4444",
    ids: [17],
  },
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
    ids: [3, 7],
  },
  {
    key: "sin_fraude",
    nombre: "SIN FRAUDE",
    colorName: "Verde",
    bg: "#10b981",
    text: "#ffffff",
    border: "#047857",
    badgeBg: "#d1fae5",
    badgeText: "#065f46",
    dotColor: "#10b981",
    ids: [15],
  },
  {
    key: "reconectado",
    nombre: "RECONECTADO",
    colorName: "Azul",
    bg: "#0284c7", // Azul vibrante
    text: "#ffffff",
    border: "#0369a1",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    dotColor: "#0ea5e9", // Punto azul
    ids: [4, 14],
  },
  {
    key: "reconectado_fraude",
    nombre: "RECONECTADO / FRAUDE",
    colorName: "Azul",
    bg: "#0284c7", // Azul
    text: "#ffffff",
    border: "#0369a1",
    badgeBg: "#e0f2fe",
    badgeText: "#0369a1",
    dotColor: "#0ea5e9", // Punto azul
    ids: [5, 10],
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
  if (!estado || !estado.nombre || !estado.nombre.trim()) {
    return {
      key: "sin_estado",
      nombre: "Sin Estado",
      colorName: "Gris",
      bg: "#64748b",
      text: "#ffffff",
      border: "#475569",
      badgeBg: "#f1f5f9",
      badgeText: "#475569",
      dotColor: "#94a3b8", // Punto gris
      ids: [],
    };
  }

  const nombre = (estado.nombre || "").trim().toUpperCase().replace(/\s+/g, " ");

  // 1. Prioridad: Lo que sea CORTE -> Rojo con punto rojo
  if (nombre.includes("CORTE")) {
    const cfgCorte = ESTADOS_MAPA_CONFIG.find((e) => e.key === "corte")!;
    return {
      ...cfgCorte,
      nombre: estado.nombre,
    };
  }

  // 2. Prioridad: Los RECONECTADOS -> Azul con punto azul
  if (nombre.includes("RECONECTAD")) {
    const cfgRec = ESTADOS_MAPA_CONFIG.find((e) => e.key === "reconectado")!;
    return {
      ...cfgRec,
      nombre: estado.nombre,
    };
  }

  // 3. Coincidencia exacta por nombre normalizado
  if (nombre) {
    const porNombreExacto = ESTADOS_MAPA_CONFIG.find((e) => {
      const eNom = e.nombre.toUpperCase().replace(/\s+/g, " ");
      return nombre === eNom;
    });
    if (porNombreExacto) return porNombreExacto;

    // Coincidencia parcial si no hubo exacta
    const porNombreParcial = ESTADOS_MAPA_CONFIG.find((e) => {
      const eNom = e.nombre.toUpperCase().replace(/\s+/g, " ");
      return nombre.includes(eNom) || eNom.includes(nombre);
    });
    if (porNombreParcial) return porNombreParcial;
  }

  // 4. Coincidencia por ID como fallback secundario
  const id = estado.id;
  if (id) {
    const porId = ESTADOS_MAPA_CONFIG.find((e) => e.ids?.includes(id));
    if (porId) return porId;
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
