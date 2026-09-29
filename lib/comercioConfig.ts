/**
 * Configuración de rubros comerciales para tarifas comerciales (T1G, T1G-I).
 */

export const TIPOS_COMERCIO = [
  "Carnicería",
  "Pollería",
  "Verdulería",
  "Clínicas",
  "Odontología",
  "Médicos",
  "Consultorios",
  "Geriátrico",
  "Clubes",
  "Piletas",
  "C. Pádel y Fútbol",
  "Despensa",
  "Fiambrería",
  "Almacén",
  "Casa de Comidas",
  "Estación de Servicios",
  "Gomería",
  "Estudio Contable",
  "Estudio Jurídico",
  "Escribanos",
  "Ingenieros",
  "Farmacia",
  "Ferretería",
  "Heladería",
  "Jardín de Infantes",
  "Escuelas",
  "Panadería",
  "Peluquería",
  "Cosmetología",
  "Pub",
  "Pizzería",
  "Bar",
  "Café",
  "Confit. Bailable",
  "Restaurante",
  "Hotel",
  "Parrilla",
  "Taller",
  "Tiendas",
  "Mercería",
  "Boutique",
  "Bijouterie",
  "Bebés",
  "Marroquinería",
  "Varios",
  "Venta Automóviles",
  "Venta Motos",
  "Casa de Familia",
  "Comercio",
  "Imprenta",
  "Oficinas",
  "Local",
  "Estudio-Oficina",
  "Servicio de Refrigerio",
  "Exposición y Venta",
  "Maderera",
  "Oficina de Gestoría",
  "Empresa",
  "Sandwichería",
  "Casa para Empleados",
  "Telefonía",
  "Forrajería, Corralón y Mat. Construcción",
  "Salón de Fiestas",
  "Estacionamiento / Garage / Cochera",
  "Inst. Enesa-Anaza",
  "Inmobiliaria",
  "Cerrajería",
  "Lavadero de Auto",
  "Radios",
  "Supermercados",
  "Iglesias",
  "Servicio Técnico",
  "Bulonería",
  "Gimnasio",
  "Galpones",
  "Remisería",
  "Sindicatos y Delegaciones",
  "Repuestos y Accesorios",
  "Seguros",
  "Distribuidora",
  "Juguetería",
  "Electrodomésticos",
  "Librería y Papelería",
  "Loterías",
  "Veterinario",
  "Tatuaje y Piercings",
  "Mueblería",
  "Plantación",
  "Bazar",
  "Ópticas",
  "Lavadero de Ropa",
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
