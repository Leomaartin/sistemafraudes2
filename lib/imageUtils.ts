export interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
  createdAt?: string | Date | null;
}

export function formatFechaImagen(img: ImagenItem): string {
  let date: Date | null = null;
  if (img.createdAt) {
    date = new Date(img.createdAt);
  } else {
    // Intentar extraer el timestamp de 13 dígitos del nombre del archivo (ej: 1790787668561-...)
    const match = img.url.match(/(\d{13})-/);
    if (match) {
      date = new Date(Number(match[1]));
    }
  }

  if (!date || isNaN(date.getTime())) return "";

  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const anio = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${anio} ${horas}:${mins} hs`;
}

export function getValidImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const clean = url.trim().replace(/\\/g, "/");
  const match = clean.match(/\/img\/.+$/i);
  if (match) return match[0];
  if (clean.toLowerCase().startsWith("img/")) return `/${clean}`;
  if (clean.toLowerCase().startsWith("public/img/")) return clean.replace(/^public/i, "");
  if (!clean.includes("/") && !clean.startsWith("http") && clean.length > 0) {
    return `/img/${clean}`;
  }
  return clean;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
