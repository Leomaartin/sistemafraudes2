/**
 * Configuración de rubros comerciales para tarifas comerciales (T1G, T1G-I).
 */

export const TIPOS_COMERCIO = [
  "Almacén",
  "Bar",
  "Bazar",
  "Bebés",
  "Bijouterie",
  "Boutique",
  "Bulonería",
  "C. Pádel y Fútbol",
  "Café",
  "Carnicería",
  "Casa de Comidas",
  "Casa de Familia",
  "Casa para Empleados",
  "Cerrajería",
  "Clínicas",
  "Clubes",
  "Comercio",
  "Confit. Bailable",
  "Consultorios",
  "Cosmetología",
  "Despensa",
  "Distribuidora",
  "Electrodomésticos",
  "Empresa",
  "Escribanos",
  "Escuelas",
  "Estación de Servicios",
  "Estacionamiento / Garage / Cochera",
  "Estudio Contable",
  "Estudio Jurídico",
  "Estudio-Oficina",
  "Exposición y Venta",
  "Farmacia",
  "Ferretería",
  "Fiambrería",
  "Forrajería, Corralón y Mat. Construcción",
  "Galpones",
  "Geriátrico",
  "Gimnasio",
  "Gomería",
  "Heladería",
  "Hotel",
  "Iglesias",
  "Imprenta",
  "Ingenieros",
  "Inmobiliaria",
  "Inst. Enesa-Anaza",
  "Jardín de Infantes",
  "Juguetería",
  "Lavadero de Auto",
  "Lavadero de Ropa",
  "Librería y Papelería",
  "Local",
  "Loterías",
  "Maderera",
  "Marroquinería",
  "Médicos",
  "Mercería",
  "Mueblería",
  "Odontología",
  "Oficina de Gestoría",
  "Oficinas",
  "Ópticas",
  "Panadería",
  "Parrilla",
  "Peluquería",
  "Piletas",
  "Pizzería",
  "Plantación",
  "Pollería",
  "Pub",
  "Radios",
  "Remisería",
  "Repuestos y Accesorios",
  "Restaurante",
  "Salón de Fiestas",
  "Sandwichería",
  "Seguros",
  "Servicio de Refrigerio",
  "Servicio Técnico",
  "Sindicatos y Delegaciones",
  "Supermercados",
  "Taller",
  "Tatuaje y Piercings",
  "Telefonía",
  "Tiendas",
  "Varios",
  "Venta Automóviles",
  "Venta Motos",
  "Verdulería",
  "Veterinario",
] as const;

export type TipoComercio = (typeof TIPOS_COMERCIO)[number] | string;

export interface RubroItem {
  id: number;
  nombre: string;
}

/**
 * Verifica si una tarifa corresponde a una tarifa comercial aplicable (T1G o T1G-I).
 */
export function esTarifaComercial(tarifaNombre?: string | null): boolean {
  if (!tarifaNombre) return false;
  const t = tarifaNombre.trim().toUpperCase();
  return t === "T1G" || t === "T1G-I" || t === "T1G - I" || t.startsWith("T1G");
}
