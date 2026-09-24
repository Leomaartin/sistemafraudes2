import * as XLSX from "xlsx";
import { ResultadoRuta, formatearDistancia } from "./rutaOptima";
import { obtenerInfoVencimiento } from "./vencimiento";

/**
 * Genera y descarga un archivo Excel profesional con 2 hojas:
 * 1. "Hoja de Ruta de Cortes": Los N cortes planificados ordenados por recorrido óptimo con distancias.
 * 2. "Listado Completo Fraudes": Todo el padrón de usuarios con fraude (formato idéntico al home).
 */
export function descargarExcelRutaOperativo(
  resultadoRuta: ResultadoRuta,
  todosLosUsuarios: any[]
) {
  // Hoja 1: Hoja de Ruta de Cortes Óptima
  const datosHojaRuta = resultadoRuta.paradas.map((parada) => {
    const vto = obtenerInfoVencimiento(parada.usuario.fechaVto);
    return {
      "Parada / Orden": parada.orden === 1 ? "1 (Punto de Partida)" : String(parada.orden),
      "N° Usuario": parada.usuario.nroUsuario,
      "Nombre y Apellido": parada.usuario.nombre,
      "Domicilio": parada.usuario.domicilio || "—",
      "N° Medidor": parada.usuario.medidor || "—",
      "Ruta / Sector": parada.usuario.ruta || "—",
      "Estado de Fraude": parada.usuario.estado?.nombre || "—",
      "Departamento": (parada.usuario.esDepartamento || parada.usuario.idEstadoDepto || parada.usuario.estadoDepto) ? (parada.usuario.estadoDepto?.nombre || "SÍ") : "NO",
      "Fecha Vto": vto.fechaFormateada !== "—" ? vto.fechaFormateada : "—",
      "Condición Vencimiento": vto.texto,
      "Distancia Tramo": parada.orden === 1 ? "Inicio" : formatearDistancia(parada.distanciaDesdeAnteriorMetros),
      "Distancia Acumulada": formatearDistancia(parada.distanciaAcumuladaMetros),
      "Latitud": parada.latitud,
      "Longitud": parada.longitud,
      "Enlace Google Maps": `https://www.google.com/maps?q=${parada.latitud},${parada.longitud}`,
      "Observaciones Técnicas": parada.usuario.observaciones || "—",
    };
  });

  // Hoja 2: Todos los usuarios con fraude (igual al Home)
  const datosTodosLosUsuarios = todosLosUsuarios.map((user) => {
    const vto = obtenerInfoVencimiento(user.fechaVto);
    return {
      "N° Usuario": user.nroUsuario,
      "Nombre": user.nombre,
      "Domicilio": user.domicilio || "",
      "Medidor": user.medidor || "",
      "Ruta": user.ruta || "",
      "Estado": user.estado?.nombre || "",
      "Departamento": (user.esDepartamento || user.idEstadoDepto || user.estadoDepto) ? (user.estadoDepto?.nombre || "SÍ") : "NO",
      "Fecha Vto": vto.fechaFormateada !== "—" ? vto.fechaFormateada : "",
      "Condición Vencimiento": vto.texto,
      "Cuadrillas": user.cuadrillas?.map((c: any) => c.nombre).join(", ") || "",
      "Tarifa": user.tarifa?.nombre || "",
      "Latitud": user.latitud ?? "",
      "Longitud": user.longitud ?? "",
      "Google Maps": user.maps || (user.latitud && user.longitud ? `https://www.google.com/maps?q=${user.latitud},${user.longitud}` : ""),
      "Observaciones": user.observaciones || "",
    };
  });

  const workbook = XLSX.utils.book_new();

  // Crear hojas
  const wsRuta = XLSX.utils.json_to_sheet(datosHojaRuta);
  const wsTodos = XLSX.utils.json_to_sheet(datosTodosLosUsuarios);

  // Auto-ajustar ancho de columnas básico
  const ajustarAnchos = (datos: any[]) => {
    if (datos.length === 0) return [];
    return Object.keys(datos[0]).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...datos.map((d) => (d[key] ? String(d[key]).length : 0))
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
    });
  };

  wsRuta["!cols"] = ajustarAnchos(datosHojaRuta);
  wsTodos["!cols"] = ajustarAnchos(datosTodosLosUsuarios);

  XLSX.utils.book_append_sheet(workbook, wsRuta, "Ruta Óptima de Cortes");
  XLSX.utils.book_append_sheet(workbook, wsTodos, "Listado Completo Fraudes");

  const fechaHoy = new Date().toISOString().split("T")[0];
  const nombreArchivo = `operativo_cortes_zarate_${fechaHoy}_${resultadoRuta.paradas.length}_cortes.xlsx`;

  XLSX.writeFile(workbook, nombreArchivo);
}
