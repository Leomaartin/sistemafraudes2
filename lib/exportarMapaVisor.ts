import { ESTADOS_MAPA_CONFIG, obtenerConfigEstadoPorUsuario } from "./estadoColors";
import { obtenerInfoVencimiento } from "./vencimiento";

export interface UsuarioParaExportar {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string | null;
  medidor: string | null;
  ruta: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaVto?: string | Date | null;
  observaciones?: string | null;
  esDepartamento?: boolean;
  idEstadoDepto?: number | null;
  estadoDepto?: { id: number; nombre: string } | null;
  estado?: {
    id: number;
    nombre: string;
  } | null;
  imagenes?: Array<{ id?: number; url: string }> | null;
}

/**
 * Escapa caracteres HTML para inyección segura en strings XML/KML
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Retorna el ícono oficial de Google Maps y el color KML correspondiente para cada estado
 */
function obtenerIconoYColorGoogleKml(configKey: string): { iconUrl: string; kmlColor: string } {
  switch (configKey) {
    case "corte":
    case "corte_fraude":
    case "fraude":
    case "baja":
    case "baja_fraude":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/red-circle.png",
        kmlColor: "ff4444ef", // Rojo
      };
    case "notificado":
    case "suspendido":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/ylw-circle.png",
        kmlColor: "ff08b3ea", // Amarillo
      };
    case "pagos_cuenta":
    case "pagos_cuenta_fraude":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/orange-circle.png",
        kmlColor: "ff1673f9", // Naranja
      };
    case "reconectado":
    case "reconectado_fraude":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/ltblu-circle.png",
        kmlColor: "ffe9a50e", // Celeste
      };
    case "retirado":
    case "retirado_fraude":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/pink-circle.png",
        kmlColor: "ff7895e2", // Color piel / peach cálido
      };
    case "sin_fraude":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/grn-circle.png",
        kmlColor: "ff81b910", // Verde
      };
    case "gerencia":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/purple-circle.png",
        kmlColor: "fff65c8b", // Violeta
      };
    case "tiempo":
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/wht-circle.png",
        kmlColor: "ff8b7464", // Gris
      };
    default:
      return {
        iconUrl: "https://maps.google.com/mapfiles/kml/paddle/wht-circle.png",
        kmlColor: "ff94a3b8", // Gris claro por defecto
      };
  }
}

/**
 * EXPORTACIÓN KML OPTIMIZADA PARA GOOGLE MAPS / GOOGLE MY MAPS / GOOGLE EARTH:
 * - Genera estilos individuales para cada estado con sus íconos y colores oficiales (rojo, amarillo, naranja, celeste, piel, etc.).
 * - Agrega ExtendedData estructurada (Estado, N° Usuario, Titular, Domicilio, Medidor, Ruta, Vencimiento) para que en Google Maps no se mezclen los puntos y queden catalogados por categorías.
 * - Incrusta las FOTOS DE INSPECCIÓN de cada usuario directamente dentro de los globos de información de Google Maps / Earth.
 * - Incluye botón de navegación directa con Google Maps.
 * - Fuerza formato binario application/octet-stream para que Windows/Chrome descargue exactamente el archivo con extensión .kml.
 */
export function exportarMapaKML({
  usuarios,
  rutaActiva,
}: {
  usuarios: UsuarioParaExportar[];
  rutaActiva?: string | null;
}): boolean {
  const validos = usuarios.filter(
    (u) =>
      u.latitud !== null &&
      u.longitud !== null &&
      !isNaN(Number(u.latitud)) &&
      !isNaN(Number(u.longitud))
  );

  if (validos.length === 0) {
    return false;
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "");
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const subtituloRuta = rutaActiva ? `Ruta ${rutaActiva}` : "Todas las Rutas";

  // Identificar todos los estados presentes para registrar sus estilos únicos
  const estilosUsados = new Set<string>();

  // Agrupar usuarios por estado para carpetas ordenadas en Google Earth y Google Maps
  const gruposPorEstado = new Map<string, UsuarioParaExportar[]>();
  validos.forEach((u) => {
    const config = obtenerConfigEstadoPorUsuario(u.estado);
    estilosUsados.add(config.key);

    const estadoNombre = u.estado?.nombre || "Sin Estado";
    if (!gruposPorEstado.has(estadoNombre)) {
      gruposPorEstado.set(estadoNombre, []);
    }
    gruposPorEstado.get(estadoNombre)!.push(u);
  });

  // Generar bloque de estilos XML para Google Maps / Earth
  let bloqueEstilos = "";
  estilosUsados.forEach((key) => {
    const estilo = obtenerIconoYColorGoogleKml(key);
    bloqueEstilos += `
    <Style id="est-${key}">
      <IconStyle>
        <color>${estilo.kmlColor}</color>
        <scale>1.15</scale>
        <Icon>
          <href>${estilo.iconUrl}</href>
        </Icon>
        <hotSpot x="32" y="1" xunits="pixels" yunits="pixels"/>
      </IconStyle>
      <LabelStyle>
        <scale>0.85</scale>
      </LabelStyle>
    </Style>
    `;
  });

  // Generar Placemarks por cada grupo de estado
  let carpetasKml = "";
  gruposPorEstado.forEach((usuariosEstado, estadoNombre) => {
    let placemarks = "";

    usuariosEstado.forEach((u) => {
      const config = obtenerConfigEstadoPorUsuario(u.estado);
      const vto = obtenerInfoVencimiento(u.fechaVto);
      const lat = Number(u.latitud);
      const lng = Number(u.longitud);

      // Galería de fotos de inspección
      let fotosHtml = "";
      const listaFotosUrls: string[] = [];

      if (u.imagenes && u.imagenes.length > 0) {
        let itemsFotos = "";
        u.imagenes.forEach((img, idx) => {
          const rawUrl = img.url || "";
          if (!rawUrl) return;
          const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl}`;
          listaFotosUrls.push(fullUrl);

          itemsFotos += `
            <div style="margin-bottom: 8px; text-align: center;">
              <a href="${escapeHtml(fullUrl)}" target="_blank" title="Ver foto completa en alta resolución">
                <img src="${escapeHtml(fullUrl)}" style="width: 100%; max-width: 290px; max-height: 190px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" alt="Foto #${idx + 1}" />
              </a>
              <div style="font-size: 10px; color: #64748b; margin-top: 3px;">
                <a href="${escapeHtml(fullUrl)}" target="_blank" style="color: #0284c7; text-decoration: none; font-weight: 500;">🔍 Ampliar foto ${idx + 1}</a>
              </div>
            </div>
          `;
        });

        if (itemsFotos) {
          fotosHtml = `
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
              <div style="font-weight: bold; color: #334155; font-size: 11px; margin-bottom: 6px;">
                📸 FOTOS DE INSPECCIÓN (${u.imagenes.length}):
              </div>
              ${itemsFotos}
            </div>
          `;
        }
      }

      // Ficha descriptiva en HTML con tabla estilizada y fotos
      const descripcionHtml = `
        <![CDATA[
          <div style="font-family: Arial, sans-serif; font-size: 13px; max-width: 320px; line-height: 1.5; color: #1e293b;">
            <div style="background: ${config.bg}; color: ${config.text}; padding: 6px 10px; border-radius: 6px; font-weight: bold; margin-bottom: 8px;">
              ${config.emoji ? `${config.emoji} ` : ""}#${escapeHtml(u.nroUsuario)} — ${escapeHtml(estadoNombre)}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr><td style="color: #64748b; font-weight: bold; padding: 3px 0; width: 85px;">Titular:</td><td style="font-weight: bold; color: #0f172a;">${escapeHtml(u.nombre)}</td></tr>
              <tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Domicilio:</td><td>${escapeHtml(u.domicilio || "—")}</td></tr>
              <tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Medidor:</td><td>${escapeHtml(u.medidor || "—")}</td></tr>
              <tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Ruta:</td><td>${escapeHtml(u.ruta || "—")}</td></tr>
              ${u.esDepartamento || u.idEstadoDepto || u.estadoDepto ? `<tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Inmueble:</td><td>🏢 ${escapeHtml(u.estadoDepto?.nombre || "Depto")}</td></tr>` : ""}
              <tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Vencimiento:</td><td style="color: #dc2626; font-weight: bold;">${escapeHtml(vto.texto)}</td></tr>
              ${u.observaciones ? `<tr><td style="color: #64748b; font-weight: bold; padding: 3px 0;">Obs:</td><td>${escapeHtml(u.observaciones)}</td></tr>` : ""}
            </table>
            ${fotosHtml}
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
              <div style="margin-bottom: 6px;">GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
              <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                <a href="${baseUrl}/ficha/${escapeHtml(u.nroUsuario)}" target="_blank" style="display: inline-block; background: #0f172a; color: #38bdf8; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11.5px; border: 1px solid #38bdf8;">
                  📸 Ficha y Fotos Online ↗
                </a>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11.5px;">
                  🚗 Navegar en Google Maps
                </a>
              </div>
            </div>
          </div>
        ]]>
      `;

      placemarks += `
        <Placemark>
          <name>#${escapeHtml(u.nroUsuario)} - ${escapeHtml(u.nombre)}</name>
          <styleUrl>#est-${config.key}</styleUrl>
          <ExtendedData>
            <Data name="Estado">
              <value>${escapeHtml(estadoNombre)}</value>
            </Data>
            <Data name="N° Usuario">
              <value>${escapeHtml(u.nroUsuario)}</value>
            </Data>
            <Data name="Titular">
              <value>${escapeHtml(u.nombre)}</value>
            </Data>
            <Data name="Domicilio">
              <value>${escapeHtml(u.domicilio || "—")}</value>
            </Data>
            <Data name="Medidor">
              <value>${escapeHtml(u.medidor || "—")}</value>
            </Data>
            <Data name="Ruta">
              <value>${escapeHtml(u.ruta || "—")}</value>
            </Data>
            <Data name="Vencimiento">
              <value>${escapeHtml(vto.texto)}</value>
            </Data>
            ${listaFotosUrls.length > 0 ? `
            <Data name="Fotos">
              <value>${escapeHtml(listaFotosUrls.join(" | "))}</value>
            </Data>
            ` : ""}
          </ExtendedData>
          <description>${descripcionHtml}</description>
          <Point>
            <coordinates>${lng},${lat},0</coordinates>
          </Point>
        </Placemark>
      `;
    });

    carpetasKml += `
      <Folder>
        <name>${escapeHtml(estadoNombre)} (${usuariosEstado.length})</name>
        ${placemarks}
      </Folder>
    `;
  });

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Fraudes Zárate - ${escapeHtml(subtituloRuta)} (${validos.length} puntos)</name>
    <description>Exportación georreferenciada de fraudes con colores e íconos oficiales por estado para Google Maps y Google Earth.</description>
    ${bloqueEstilos}
    ${carpetasKml}
  </Document>
</kml>`;

  // Se usa application/octet-stream para forzar a Chrome y Windows a respetar la extensión .kml sin anexar .txt
  const blob = new Blob([kmlContent], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const nombreArchivo = `mapa-fraudes-zarate${rutaActiva ? `-ruta-${rutaActiva}` : ""}-${fechaArchivo}.kml`;
  link.href = url;
  link.setAttribute("download", nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 60000);

  return true;
}
