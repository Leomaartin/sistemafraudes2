export interface OpcionDepartamento {
  id: number;
  nombre: string;
  descripcion?: string;
  icono?: string;
}

export const OPCIONES_DEPARTAMENTO: OpcionDepartamento[] = [
  {
    id: 14,
    nombre: "SIN LLAVE",
    descripcion: "No se cuenta con llave de acceso",
    icono: "🚫",
  },
  {
    id: 15,
    nombre: "CON LLAVE / FACTURACION",
    descripcion: "Se dispone de llave / vía facturación",
    icono: "🔑",
  },
  {
    id: 16,
    nombre: "NO TENEMOS LLAVE",
    descripcion: "Sin llave disponible en cuadrilla",
    icono: "🔒",
  },
  {
    id: 17,
    nombre: "PORTERO/ADMINISTRACION",
    descripcion: "Acceso coordinado con portería o administración",
    icono: "🛎️",
  },
];

export const IDS_DEPARTAMENTO = [14, 15, 16, 17];
