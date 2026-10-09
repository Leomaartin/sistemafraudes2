"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../css/usuarios.css";
import Popup from "../components/popup";
import PopupEdit from "../components/popupedit";
import ExcelJS from "exceljs";
import { obtenerInfoVencimiento, InfoVencimiento } from "@/lib/vencimiento";
import { OPCIONES_DEPARTAMENTO, IDS_DEPARTAMENTO } from "@/lib/departamentoConfig";
import { TIPOS_COMERCIO, esTarifaComercial } from "@/lib/comercioConfig";
import { parsearObservaciones } from "@/lib/observaciones";

export interface CatalogoItem {
  id: number;
  nombre: string;
}

export interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
}

export interface UsuarioItem {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string | null;
  medidor: string | null;
  ruta: string | null;
  observaciones: string | null;
  maps: string | null;
  latitud?: number | null;
  longitud?: number | null;
  fechaVto?: string | Date | null;
  idEstado: number | null;
  idTarifa: number | null;
  esDepartamento?: boolean;
  idEstadoDepto?: number | null;
  estadoDepto?: CatalogoItem | null;
  rubroComercio?: string | null;
  idRubro?: number | null;
  rubro?: CatalogoItem | null;
  nombreComercio?: string | null;
  cuadrillas?: CatalogoItem[];
  estado?: CatalogoItem | null;
  tarifa?: CatalogoItem | null;
  imagenes?: ImagenItem[];
}

function getEstadoBadgeInfo(estado?: CatalogoItem | null) {
  if (!estado || !estado.nombre || !estado.nombre.trim()) {
    return {
      nombre: "Sin Estado",
      badgeClass: "estado-sin-estado",
      bulletClass: "bullet-sin-estado",
    };
  }

  const nom = estado.nombre.trim().toUpperCase();

  // 1. Lo que sea corte -> rojo con un punto rojo
  if (nom.includes("CORTE")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-corte",
      bulletClass: "bullet-corte",
    };
  }

  // 2. Reconectados -> azul con un punto azul
  if (nom.includes("RECONECTAD")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-reconectado",
      bulletClass: "bullet-reconectado",
    };
  }

  // 3. Fraude -> dejalos como están (verde institucional)
  if (nom.includes("FRAUDE")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-fraude",
      bulletClass: "bullet-fraude",
    };
  }

  // 4. Sin Fraude
  if (nom.includes("SIN FRAUDE")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-sin-fraude",
      bulletClass: "bullet-sin-fraude",
    };
  }

  // 5. Notificado / Suspendido
  if (nom.includes("NOTIFICAD")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-notificado",
      bulletClass: "bullet-notificado",
    };
  }
  if (nom.includes("SUSPENDID")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-suspendido",
      bulletClass: "bullet-suspendido",
    };
  }

  // 6. Baja
  if (nom.includes("BAJA")) {
    return {
      nombre: estado.nombre,
      badgeClass: "estado-baja",
      bulletClass: "bullet-baja",
    };
  }

  return {
    nombre: estado.nombre,
    badgeClass: "estado-general",
    bulletClass: "bullet-general",
  };
}

interface ColumnaExportItem {
  id: string;
  label: string;
  grupo: string;
  default: boolean;
  getValue: (user: UsuarioItem) => any;
}

const COLUMNAS_EXPORTAR: ColumnaExportItem[] = [
  // Identificación
  { id: "nroUsuario", label: "N° Usuario", grupo: "Identificación del Usuario", default: true, getValue: (u) => u.nroUsuario },
  { id: "nombre", label: "Nombre / Titular", grupo: "Identificación del Usuario", default: true, getValue: (u) => u.nombre },
  { id: "domicilio", label: "Domicilio", grupo: "Identificación del Usuario", default: true, getValue: (u) => u.domicilio || "" },
  { id: "medidor", label: "N° Medidor", grupo: "Identificación del Usuario", default: true, getValue: (u) => u.medidor || "" },
  { id: "ruta", label: "Ruta / Sector", grupo: "Identificación del Usuario", default: true, getValue: (u) => u.ruta || "" },

  // Estado y Gestión
  { id: "estado", label: "Estado del Fraude", grupo: "Estado y Gestión", default: true, getValue: (u) => u.estado?.nombre || "" },
  {
    id: "departamento",
    label: "Departamento / Acceso",
    grupo: "Estado y Gestión",
    default: true,
    getValue: (u) => (u.esDepartamento || u.idEstadoDepto || u.estadoDepto)
      ? (u.estadoDepto?.nombre || OPCIONES_DEPARTAMENTO.find((o) => o.id === u.idEstadoDepto)?.nombre || "SÍ")
      : "NO"
  },
  { id: "cuadrillas", label: "Cuadrillas Asignadas", grupo: "Estado y Gestión", default: true, getValue: (u) => u.cuadrillas?.map((c) => c.nombre).join(", ") || "" },
  { id: "tarifa", label: "Tarifa", grupo: "Estado y Gestión", default: true, getValue: (u) => u.tarifa?.nombre || "" },
  {
    id: "fechaVto",
    label: "Fecha de Vencimiento",
    grupo: "Estado y Gestión",
    default: true,
    getValue: (u) => {
      const vto = obtenerInfoVencimiento(u.fechaVto);
      return vto.fechaFormateada !== "—" ? vto.fechaFormateada : "";
    }
  },
  {
    id: "condicionVto",
    label: "Condición de Vencimiento",
    grupo: "Estado y Gestión",
    default: true,
    getValue: (u) => obtenerInfoVencimiento(u.fechaVto).texto
  },

  // Geolocalización
  { id: "geolocalizado", label: "Geolocalizado (SÍ/NO)", grupo: "Geolocalización", default: true, getValue: (u) => (u.latitud && u.longitud) ? "SÍ" : "NO (Sin Maps)" },
  { id: "latitud", label: "Latitud", grupo: "Geolocalización", default: true, getValue: (u) => u.latitud ?? "" },
  { id: "longitud", label: "Longitud", grupo: "Geolocalización", default: true, getValue: (u) => u.longitud ?? "" },
  { id: "maps", label: "Enlace Google Maps", grupo: "Geolocalización", default: true, getValue: (u) => u.maps || "" },

  // Comercio y Observaciones
  { id: "rubroComercio", label: "Tipo de Comercio / Rubro", grupo: "Comercio y Observaciones", default: true, getValue: (u) => u.rubro?.nombre || u.rubroComercio || "" },
  { id: "nombreComercio", label: "Nombre Informal Comercio", grupo: "Comercio y Observaciones", default: true, getValue: (u) => u.nombreComercio || "" },
  { id: "observaciones", label: "Observaciones Técnicas", grupo: "Comercio y Observaciones", default: true, getValue: (u) => u.observaciones || "" },
];

const GRUPOS_COLUMNAS = Array.from(new Set(COLUMNAS_EXPORTAR.map((c) => c.grupo)));

export default function Home() {
  const [allUsers, setAllUsers] = useState<UsuarioItem[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [imagenes, setImagenes] = useState<ImagenItem[]>([]);
  const [showPopupEdit, setShowPopupEdit] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioItem | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Estados de filtros
  const [searchName, setSearchName] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [searchDomicilio, setSearchDomicilio] = useState("");
  const [searchRuta, setSearchRuta] = useState("");
  const [cuadrillas, setCuadrillas] = useState<CatalogoItem[]>([]);
  const [searchCuadrilla, setSearchCuadrilla] = useState("");
  const [estados, setEstados] = useState<CatalogoItem[]>([]);
  const [searchEstados, setSearchEstados] = useState("");
  const [tarifas, setTarifas] = useState<CatalogoItem[]>([]);
  const [searchTarifas, setSearchTarifas] = useState("");
  const [searchRubroComercio, setSearchRubroComercio] = useState("");
  const [searchNombreComercio, setSearchNombreComercio] = useState("");
  const [searchEstadoVto, setSearchEstadoVto] = useState("");
  const [searchVtoDesde, setSearchVtoDesde] = useState("");
  const [searchVtoHasta, setSearchVtoHasta] = useState("");
  const [searchDepto, setSearchDepto] = useState("");
  const [searchUbicacion, setSearchUbicacion] = useState(""); // "" | "con_geo" | "sin_geo"

  // Filtros con soporte para múltiples valores simultáneos
  const [filtrosEstados, setFiltrosEstados] = useState<string[]>([]);
  const [filtrosDomicilios, setFiltrosDomicilios] = useState<string[]>([]);
  const [filtrosRutas, setFiltrosRutas] = useState<string[]>([]);
  const [filtrosCuadrillas, setFiltrosCuadrillas] = useState<string[]>([]);
  const [filtrosTarifas, setFiltrosTarifas] = useState<string[]>([]);
  const [filtrosNombres, setFiltrosNombres] = useState<string[]>([]);
  const [filtrosNumeros, setFiltrosNumeros] = useState<string[]>([]);

  // Control del selector desplegable "+ Agregar filtro"
  const [caracteristicaSeleccionada, setCaracteristicaSeleccionada] = useState("");
  const [valorNuevoFiltro, setValorNuevoFiltro] = useState("");

  // Control del menú desplegable de filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Estados de paginación y carga
  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(50);
  const [cargando, setCargando] = useState(true);
  const [inputSalto, setInputSalto] = useState("");

  // Estados para modal de selección de columnas al exportar Excel
  const [showModalExport, setShowModalExport] = useState(false);
  const [columnasSeleccionadas, setColumnasSeleccionadas] = useState<string[]>(
    COLUMNAS_EXPORTAR.map((c) => c.id)
  );
  const [pintarFilasPorEstado, setPintarFilasPorEstado] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const toggleColumna = (id: string) => {
    setColumnasSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const seleccionarTodasColumnas = () => {
    setColumnasSeleccionadas(COLUMNAS_EXPORTAR.map((c) => c.id));
  };

  const deseleccionarTodasColumnas = () => {
    setColumnasSeleccionadas([]);
  };

  // Abrir modal de selección de columnas
  const exportarExcel = () => {
    setShowModalExport(true);
  };

  // Ejecutar exportación real con las columnas seleccionadas y estilo condicional
  const confirmarExportacionExcel = async () => {
    if (columnasSeleccionadas.length === 0) {
      toast.warning("Selecciona al menos una característica para exportar.");
      return;
    }

    try {
      setExportandoExcel(true);

      const colsToExport = COLUMNAS_EXPORTAR.filter((c) => columnasSeleccionadas.includes(c.id));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sistema Fraudes Zárate";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Usuarios", {
        views: [{ state: "frozen", ySplit: 1 }]
      });

      // Configurar columnas
      worksheet.columns = colsToExport.map((col) => ({
        header: col.label,
        key: col.id,
        width: Math.max(col.label.length + 5, 14),
      }));

      // Estilo de encabezado institucional verde Excel
      const headerRow = worksheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Segoe UI",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF107C41" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: false,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF0B5C2F" } },
          bottom: { style: "medium", color: { argb: "FF0B5C2F" } },
          left: { style: "thin", color: { argb: "FF107C41" } },
          right: { style: "thin", color: { argb: "FF107C41" } },
        };
      });

      // Paleta suave de tonos según el estado (legible y profesional)
      const obtenerEstiloEstado = (estadoNombre?: string) => {
        if (!estadoNombre) return null;
        const nom = estadoNombre.toUpperCase();
        if (nom.includes("CORTE")) {
          return { bg: "FFFEE2E2", border: "FFFCA5A5", font: "FF991B1B" };
        }
        if (nom.includes("RECONECTAD")) {
          return { bg: "FFE0F2FE", border: "FFBAE6FD", font: "FF0369A1" };
        }
        if (nom.includes("FRAUDE") && !nom.includes("SIN")) {
          return { bg: "FFDCFCE7", border: "FFBBF7D0", font: "FF166534" };
        }
        if (nom.includes("SIN FRAUDE")) {
          return { bg: "FFCCFBF1", border: "FF99F6E4", font: "FF0F766E" };
        }
        if (nom.includes("NOTIFICAD") || nom.includes("SUSPENDID")) {
          return { bg: "FFFEF3C7", border: "FFFDE68A", font: "FF92400E" };
        }
        if (nom.includes("BAJA")) {
          return { bg: "FFFFE4E6", border: "FFFECDD3", font: "FF9F1239" };
        }
        return { bg: "FFF1F5F9", border: "FFE2E8F0", font: "FF334155" };
      };

      // Inserción de filas con estilos
      filteredUsers.forEach((user, index) => {
        const rowData: Record<string, any> = {};
        colsToExport.forEach((col) => {
          rowData[col.id] = col.getValue(user);
        });

        const row = worksheet.addRow(rowData);
        row.height = 22;

        const estilo = pintarFilasPorEstado ? obtenerEstiloEstado(user.estado?.nombre) : null;

        row.eachCell((cell, colNumber) => {
          const colDef = colsToExport[colNumber - 1];
          const isCentered = ["nroUsuario", "medidor", "ruta", "geolocalizado", "fechaVto", "condicionVto", "departamento"].includes(colDef?.id);

          cell.font = {
            name: "Segoe UI",
            size: 10,
            color: { argb: estilo ? estilo.font : "FF1E293B" },
            bold: colDef?.id === "nroUsuario" || (estilo !== null && colDef?.id === "estado"),
          };

          cell.alignment = {
            vertical: "middle",
            horizontal: isCentered ? "center" : "left",
          };

          if (estilo) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: estilo.bg },
            };
            cell.border = {
              top: { style: "thin", color: { argb: estilo.border } },
              bottom: { style: "thin", color: { argb: estilo.border } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          } else {
            // Fondo suave alternado si no se colorean por estado
            if (index % 2 === 1) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" },
              };
            }
            cell.border = {
              top: { style: "thin", color: { argb: "FFF1F5F9" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFF1F5F9" } },
              right: { style: "thin", color: { argb: "FFF1F5F9" } },
            };
          }
        });
      });

      // Autoajustar el ancho de las columnas según su contenido
      worksheet.columns.forEach((col) => {
        let maxLen = 0;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const valStr = cell.value ? String(cell.value) : "";
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        });
        col.width = Math.max(maxLen + 4, 14);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `usuarios_${pintarFilasPorEstado ? "coloreados_" : ""}filtrados.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setShowModalExport(false);
      toast.success(
        `Planilla descargada con ${filteredUsers.length} usuarios y ${colsToExport.length} características${
          pintarFilasPorEstado ? " coloreadas según su estado" : ""
        }.`
      );
    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast.error("Ocurrió un error al generar el archivo Excel.");
    } finally {
      setExportandoExcel(false);
    }
  };

  // Función para recargar los usuarios tras editar o eliminar
  const fetchAllUsers = useCallback(async () => {
    try {
      setCargando(true);
      const res = await fetch("/api/usuariosapi");
      if (!res.ok) {
        throw new Error("Error al obtener la lista de usuarios");
      }
      const users: UsuarioItem[] = await res.json();
      setAllUsers(users);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial unificada
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setCargando(true);
        const [resUsers, resCuadrillas, resEstados, resTarifas] = await Promise.all([
          fetch("/api/usuariosapi"),
          fetch("/api/cuadrillasapi"),
          fetch("/api/estadosapi"),
          fetch("/api/tarifasapi"),
        ]);

        if (resUsers.ok) {
          const dataUsers: UsuarioItem[] = await resUsers.json();
          if (isMounted) setAllUsers(dataUsers);
        }

        if (resCuadrillas.ok) {
          const dataCuadrillas: CatalogoItem[] = await resCuadrillas.json();
          if (isMounted) setCuadrillas(dataCuadrillas);
        }

        if (resEstados.ok) {
          const dataEstados: CatalogoItem[] = await resEstados.json();
          if (isMounted) setEstados(dataEstados);
        }

        if (resTarifas.ok) {
          const dataTarifas: CatalogoItem[] = await resTarifas.json();
          if (isMounted) setTarifas(dataTarifas);
        }
      } catch (error: unknown) {
        console.error("Error al cargar datos iniciales:", error);
      } finally {
        if (isMounted) setCargando(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const ejecutarEliminar = async () => {
    if (!usuarioAEliminar) return;

    setEliminando(true);
    try {
      const res = await fetch(`/api/users?id=${usuarioAEliminar.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar el usuario");
      }

      toast.success(`Usuario "${usuarioAEliminar.nombre}" eliminado correctamente`);
      setUsuarioAEliminar(null);
      fetchAllUsers();
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : "Error al eliminar el usuario";
      console.error("Error eliminando usuario:", error);
      toast.error(mensaje);
    } finally {
      setEliminando(false);
    }
  };

  const abrirPopup = async (usuarioId: number) => {
    try {
      const usuario = allUsers.find((user) => user.id === usuarioId);
      setUsuarioSeleccionado(usuario || null);
      setShowPopup(true);

      const res = await fetch(`/api/img?usuarioId=${usuarioId}`);
      if (!res.ok) {
        throw new Error("Error al obtener las imágenes");
      }
      const data: ImagenItem[] = await res.json();
      setImagenes(data);
    } catch (error: unknown) {
      console.error("Error obteniendo imágenes:", error);
    }
  };

  const abrirPopupEdit = (usuarioId: number) => {
    const usuario = allUsers.find((user) => user.id === usuarioId);
    if (usuario) {
      setUsuarioSeleccionado(usuario);
    } else {
      setUsuarioSeleccionado({
        id: usuarioId,
        nroUsuario: "",
        nombre: "",
        domicilio: null,
        medidor: null,
        ruta: null,
        observaciones: null,
        maps: null,
        idEstado: null,
        idTarifa: null,
        esDepartamento: false,
        idEstadoDepto: null,
      });
    }
    setShowPopupEdit(true);
  };

  const cerrarPopup = () => {
    setShowPopup(false);
    setImagenes([]);
  };

  const cerrarPopupEdit = () => {
    setShowPopupEdit(false);
  };

  // Manejadores para agregar y quitar múltiples filtros
  const agregarEstado = (nombre: string) => {
    if (!nombre) return;
    setFiltrosEstados((prev) => (prev.includes(nombre) ? prev : [...prev, nombre]));
    setSearchEstados("");
  };

  const removerEstado = (nombre: string) => {
    setFiltrosEstados((prev) => prev.filter((e) => e !== nombre));
  };

  const agregarDomicilio = (dom: string) => {
    const trimmed = dom.trim();
    if (!trimmed) return;
    setFiltrosDomicilios((prev) =>
      prev.some((d) => d.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
    setSearchDomicilio("");
  };

  const removerDomicilio = (dom: string) => {
    setFiltrosDomicilios((prev) => prev.filter((d) => d.toLowerCase() !== dom.toLowerCase()));
  };

  const agregarRuta = (ruta: string) => {
    const trimmed = ruta.trim();
    if (!trimmed) return;
    setFiltrosRutas((prev) =>
      prev.some((r) => r.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
    setSearchRuta("");
  };

  const removerRuta = (ruta: string) => {
    setFiltrosRutas((prev) => prev.filter((r) => r.toLowerCase() !== ruta.toLowerCase()));
  };

  const agregarCuadrilla = (cuad: string) => {
    if (!cuad) return;
    setFiltrosCuadrillas((prev) => (prev.includes(cuad) ? prev : [...prev, cuad]));
    setSearchCuadrilla("");
  };

  const removerCuadrilla = (cuad: string) => {
    setFiltrosCuadrillas((prev) => prev.filter((c) => c !== cuad));
  };

  const agregarTarifa = (tar: string) => {
    if (!tar) return;
    setFiltrosTarifas((prev) => (prev.includes(tar) ? prev : [...prev, tar]));
    setSearchTarifas("");
  };

  const removerTarifa = (tar: string) => {
    setFiltrosTarifas((prev) => prev.filter((t) => t !== tar));
  };

  const agregarNombre = (nom: string) => {
    const trimmed = nom.trim();
    if (!trimmed) return;
    setFiltrosNombres((prev) =>
      prev.some((n) => n.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
    setSearchName("");
  };

  const removerNombre = (nom: string) => {
    setFiltrosNombres((prev) => prev.filter((n) => n.toLowerCase() !== nom.toLowerCase()));
  };

  const agregarNumero = (num: string) => {
    const trimmed = num.trim();
    if (!trimmed) return;
    setFiltrosNumeros((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSearchNumber("");
  };

  const removerNumero = (num: string) => {
    setFiltrosNumeros((prev) => prev.filter((n) => n !== num));
  };

  const ejecutarAgregarFiltro = () => {
    if (!caracteristicaSeleccionada || !valorNuevoFiltro.trim()) return;

    switch (caracteristicaSeleccionada) {
      case "estado":
        agregarEstado(valorNuevoFiltro);
        break;
      case "domicilio":
        agregarDomicilio(valorNuevoFiltro);
        break;
      case "ruta":
        agregarRuta(valorNuevoFiltro);
        break;
      case "cuadrilla":
        agregarCuadrilla(valorNuevoFiltro);
        break;
      case "tarifa":
        agregarTarifa(valorNuevoFiltro);
        break;
      case "nombre":
        agregarNombre(valorNuevoFiltro);
        break;
      case "numero":
        agregarNumero(valorNuevoFiltro);
        break;
      case "depto":
        setSearchDepto(valorNuevoFiltro);
        break;
      case "ubicacion":
        setSearchUbicacion(valorNuevoFiltro);
        break;
      case "estadoVto":
        setSearchEstadoVto(valorNuevoFiltro);
        break;
    }
    setValorNuevoFiltro("");
    setCaracteristicaSeleccionada("");
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setSearchName("");
    setSearchNumber("");
    setSearchDomicilio("");
    setSearchRuta("");
    setSearchCuadrilla("");
    setSearchEstados("");
    setSearchTarifas("");
    setSearchRubroComercio("");
    setSearchNombreComercio("");
    setSearchEstadoVto("");
    setSearchVtoDesde("");
    setSearchVtoHasta("");
    setSearchDepto("");
    setSearchUbicacion("");
    setFiltrosEstados([]);
    setFiltrosDomicilios([]);
    setFiltrosRutas([]);
    setFiltrosCuadrillas([]);
    setFiltrosTarifas([]);
    setFiltrosNombres([]);
    setFiltrosNumeros([]);
    setCaracteristicaSeleccionada("");
    setValorNuevoFiltro("");
  };

  // Detectar si la tarifa seleccionada para filtrar es comercial (T1G o T1G-I)
  const esFiltroTarifaComercial = esTarifaComercial(searchTarifas) || filtrosTarifas.some(esTarifaComercial);

  // Conteo de filtros activos
  const activeFiltersCount =
    filtrosEstados.length +
    filtrosDomicilios.length +
    filtrosRutas.length +
    filtrosCuadrillas.length +
    filtrosTarifas.length +
    filtrosNombres.length +
    filtrosNumeros.length +
    [
      searchName,
      searchNumber,
      searchDomicilio,
      searchRuta,
      searchCuadrilla,
      searchEstados,
      searchTarifas,
      searchEstadoVto,
      searchVtoDesde,
      searchVtoHasta,
      searchDepto,
      searchUbicacion,
      esFiltroTarifaComercial ? searchRubroComercio : "",
      esFiltroTarifaComercial ? searchNombreComercio : "",
    ].filter((val) => val.trim() !== "").length;

  const filteredUsers = allUsers.filter((user) => {
    // Nombre
    const allNombres = [...filtrosNombres, ...(searchName.trim() ? [searchName.trim()] : [])];
    const matchName =
      allNombres.length === 0 ||
      allNombres.some((n) => (user.nombre || "").toLowerCase().includes(n.toLowerCase()));

    // Número
    const allNumeros = [...filtrosNumeros, ...(searchNumber.trim() ? [searchNumber.trim()] : [])];
    const matchNumber =
      allNumeros.length === 0 ||
      allNumeros.some((num) => (user.nroUsuario || "").toString().includes(num));

    // Domicilio: Soporta múltiples domicilios simultáneos (OR)
    const allDomicilios = [...filtrosDomicilios, ...(searchDomicilio.trim() ? [searchDomicilio.trim()] : [])];
    const userDom = (user.domicilio || "").toLowerCase();
    const matchDomicilio =
      allDomicilios.length === 0 ||
      allDomicilios.some((d) => userDom.includes(d.toLowerCase()));

    // Ruta
    const allRutas = [...filtrosRutas, ...(searchRuta.trim() ? [searchRuta.trim()] : [])];
    const userRuta = (user.ruta || "").toLowerCase();
    const matchRuta =
      allRutas.length === 0 ||
      allRutas.some((r) => userRuta.includes(r.toLowerCase()));

    // Cuadrilla
    const allCuadrillas = [...filtrosCuadrillas, ...(searchCuadrilla ? [searchCuadrilla] : [])];
    const matchCuadrilla =
      allCuadrillas.length === 0 ||
      allCuadrillas.some((c) =>
        user.cuadrillas && user.cuadrillas.some((cu) => cu.nombre.toLowerCase() === c.toLowerCase())
      );

    // Tarifa
    const allTarifas = [...filtrosTarifas, ...(searchTarifas ? [searchTarifas] : [])];
    const matchTarifa =
      allTarifas.length === 0 ||
      allTarifas.some((t) => (user.tarifa?.nombre || "").toLowerCase() === t.toLowerCase());

    // Estado: Soporta múltiples estados simultáneos (OR)
    const allEstados = [...filtrosEstados, ...(searchEstados ? [searchEstados] : [])];
    const matchEstado =
      allEstados.length === 0 ||
      allEstados.some((e) => (user.estado?.nombre || "").toLowerCase() === e.toLowerCase());

    if (!matchName || !matchNumber || !matchDomicilio || !matchRuta || !matchCuadrilla || !matchTarifa || !matchEstado) {
      return false;
    }

    // Filtro condicional por comercio (si la tarifa seleccionada es T1G o T1G-I)
    if (esFiltroTarifaComercial) {
      const rubroActual = (user.rubro?.nombre || user.rubroComercio || "").toLowerCase();
      if (searchRubroComercio && rubroActual !== searchRubroComercio.toLowerCase()) {
        return false;
      }
      if (searchNombreComercio.trim()) {
        const term = searchNombreComercio.trim().toLowerCase();
        if (!user.nombreComercio || !user.nombreComercio.toLowerCase().includes(term)) {
          return false;
        }
      }
    }

    // Filtro por departamento / acceso
    if (searchDepto === "si") {
      const isDepto = user.esDepartamento || user.idEstadoDepto || user.estadoDepto || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id));
      if (!isDepto) return false;
    } else if (searchDepto === "no") {
      const isDepto = user.esDepartamento || user.idEstadoDepto || user.estadoDepto || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id));
      if (isDepto) return false;
    } else if (searchDepto) {
      const targetId = Number(searchDepto);
      const userDeptoId = user.idEstadoDepto || user.estadoDepto?.id || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id) ? user.estado.id : null);
      if (userDeptoId !== targetId) return false;
    }

    // Filtro por estado de vencimiento
    if (searchEstadoVto) {
      const vto = obtenerInfoVencimiento(user.fechaVto);
      if (searchEstadoVto === "vencidas" && vto.estado !== "vencida") return false;
      if (searchEstadoVto === "por_vencer" && vto.estado !== "por_vencer" && vto.estado !== "vence_hoy") return false;
      if (searchEstadoVto === "vigentes" && (vto.estado === "vencida" || vto.estado === "sin_fecha")) return false;
      if (searchEstadoVto === "sin_fecha" && vto.estado !== "sin_fecha") return false;
    }

    // Filtro por rango de fecha de vencimiento
    if (searchVtoDesde || searchVtoHasta) {
      if (!user.fechaVto) return false;
      const vtoDate = new Date(user.fechaVto);
      const yyyy = vtoDate.getUTCFullYear();
      const mm = String(vtoDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(vtoDate.getUTCDate()).padStart(2, "0");
      const userDateStr = `${yyyy}-${mm}-${dd}`;

      if (searchVtoDesde && userDateStr < searchVtoDesde) return false;
      if (searchVtoHasta && userDateStr > searchVtoHasta) return false;
    }

    // Filtro por ubicación / georreferenciación (Maps)
    if (searchUbicacion === "con_geo") {
      if (!user.latitud || !user.longitud) return false;
    } else if (searchUbicacion === "sin_geo") {
      if (user.latitud && user.longitud) return false;
    }

    return true;
  });

  // Resetear a página 1 cuando se alteran los filtros o la cantidad por página
  useEffect(() => {
    setPaginaActual(1);
  }, [
    searchName,
    searchNumber,
    searchDomicilio,
    searchRuta,
    searchCuadrilla,
    searchEstados,
    searchTarifas,
    searchEstadoVto,
    searchVtoDesde,
    searchVtoHasta,
    searchDepto,
    searchUbicacion,
    searchRubroComercio,
    searchNombreComercio,
    filtrosEstados,
    filtrosDomicilios,
    filtrosRutas,
    filtrosCuadrillas,
    filtrosTarifas,
    filtrosNombres,
    filtrosNumeros,
    porPagina,
  ]);

  const totalUsuariosFiltrados = filteredUsers.length;
  const totalPaginas = Math.max(1, Math.ceil(totalUsuariosFiltrados / porPagina));
  const indexInicio = totalUsuariosFiltrados === 0 ? 0 : (paginaActual - 1) * porPagina;
  const indexFin = Math.min(indexInicio + porPagina, totalUsuariosFiltrados);
  const usuariosPaginados = filteredUsers.slice(indexInicio, indexFin);

  const cambiarPagina = (nuevaPagina: number) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    setPaginaActual(nuevaPagina);
    const el = document.getElementById("seccion-lista-usuarios");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const generarBotonesPaginacion = () => {
    const botones: (number | string)[] = [];
    const delta = 2;

    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) botones.push(i);
    } else {
      botones.push(1);
      if (paginaActual - delta > 2) {
        botones.push("...");
      }
      const start = Math.max(2, paginaActual - delta);
      const end = Math.min(totalPaginas - 1, paginaActual + delta);
      for (let i = start; i <= end; i++) {
        botones.push(i);
      }
      if (paginaActual + delta < totalPaginas - 1) {
        botones.push("...");
      }
      botones.push(totalPaginas);
    }
    return botones;
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchName(e.target.value);
  };
  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchNumber(e.target.value);
  };
  const handleDomicilio = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchDomicilio(e.target.value);
  };
  const handleRuta = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchRuta(e.target.value);
  };

  return (
    <div>
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <main>
        <h3>
          Sistema de Gestión de Deudas y Usuarios
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Botón de Excel con logo oficial de Excel */}
            <button
              onClick={exportarExcel}
              className="btn-exportar-excel"
              title="Exportar usuarios filtrados a Excel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ffffff" fillOpacity="0.25"/>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#ffffff" strokeWidth="2"/>
                <path d="M14 2v6h6" stroke="#ffffff" strokeWidth="2"/>
                <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
              <span>Exportar Excel</span>
            </button>
            <Link href="/admin" className="administrar-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              Administrar
            </Link>
          </div>
        </h3>

        {/* Sección de Filtros */}
        <div className="search-container">
          <div className="filtros-control-bar">
            {/* Input de búsqueda rápida */}
            <div className="search-quick-box">
              <svg
                className="search-quick-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="search-quick-input"
                type="text"
                placeholder="Buscar rápido por nombre..."
                value={searchName}
                onChange={handleSearch}
              />
              {searchName && (
                <button
                  type="button"
                  className="btn-quick-clear"
                  onClick={() => setSearchName("")}
                  title="Borrar búsqueda"
                  aria-label="Borrar búsqueda"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Botón para desplegar el menú de filtros */}
            <button
              type="button"
              className={`btn-toggle-filtros ${mostrarFiltros ? "active" : ""}`}
              onClick={() => setMostrarFiltros((prev) => !prev)}
              aria-expanded={mostrarFiltros}
              title="Mostrar u ocultar opciones de filtrado"
            >
              <svg
                className="icon-funnel"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="badge-active-count">{activeFiltersCount}</span>
              )}
              <svg
                className={`icon-chevron ${mostrarFiltros ? "rotated" : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Botón para limpiar todos los filtros */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn-limpiar-filtros"
                onClick={limpiarFiltros}
                title="Limpiar todos los filtros"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Menú desplegable de filtros */}
          <div className={`filtros ${mostrarFiltros ? "filtros-open" : "filtros-closed"}`}>
            <div className="filtros-header">
              <div className="filtros-header-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span className="filtros-header-title">Filtros de búsqueda</span>
                {activeFiltersCount > 0 && (
                  <span className="filtros-header-tag">
                    {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  className="filtros-header-reset-btn"
                  onClick={limpiarFiltros}
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            {/* Panel dinámico: Agregar filtro por cualquier característica */}
            <div className="filtros-add-section">
              <div className="filtros-add-header">
                <div className="filtros-add-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Agregar filtro por característica</span>
                </div>
                <span className="filtros-add-hint">
                  Podés agregar múltiples filtros de estado, domicilio o la característica que quieras
                </span>
              </div>

              <div className="filtros-add-control-row">
                <div className="filtros-add-select-wrap">
                  <select
                    id="select-caracteristica-nueva"
                    className="filtro-select-caracteristica"
                    value={caracteristicaSeleccionada}
                    onChange={(e) => {
                      setCaracteristicaSeleccionada(e.target.value);
                      setValorNuevoFiltro("");
                    }}
                  >
                    <option value="">➕ Seleccionar característica a agregar...</option>
                    <option value="estado">📌 Estado ({estados.length} opciones)</option>
                    <option value="domicilio">🏠 Domicilio (Calle o dirección)</option>
                    <option value="ruta">🧭 Ruta</option>
                    <option value="cuadrilla">👥 Cuadrilla ({cuadrillas.length} opciones)</option>
                    <option value="tarifa">⚡ Tarifa ({tarifas.length} opciones)</option>
                    <option value="nombre">👤 Nombre de usuario</option>
                    <option value="numero">🔢 N° Usuario</option>
                    <option value="depto">🏢 Inmueble / Condición Llave</option>
                    <option value="ubicacion">📍 Geolocalización / Maps</option>
                    <option value="estadoVto">📅 Estado Fecha Vencimiento</option>
                  </select>
                </div>

                {caracteristicaSeleccionada && (
                  <div className="filtros-add-value-wrap">
                    {caracteristicaSeleccionada === "estado" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar un estado...</option>
                        {estados
                          .filter((est) => !IDS_DEPARTAMENTO.includes(est.id))
                          .map((est) => (
                            <option
                              key={est.id}
                              value={est.nombre}
                              disabled={filtrosEstados.includes(est.nombre)}
                            >
                              {est.nombre} {filtrosEstados.includes(est.nombre) ? "(ya agregado)" : ""}
                            </option>
                          ))}
                      </select>
                    )}

                    {caracteristicaSeleccionada === "domicilio" && (
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Escribí calle o dirección y presioná Enter..."
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            ejecutarAgregarFiltro();
                          }
                        }}
                        autoFocus
                      />
                    )}

                    {caracteristicaSeleccionada === "ruta" && (
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Escribí ruta y presioná Enter..."
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            ejecutarAgregarFiltro();
                          }
                        }}
                        autoFocus
                      />
                    )}

                    {caracteristicaSeleccionada === "cuadrilla" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar cuadrilla...</option>
                        {cuadrillas.map((c) => (
                          <option
                            key={c.id}
                            value={c.nombre}
                            disabled={filtrosCuadrillas.includes(c.nombre)}
                          >
                            {c.nombre} {filtrosCuadrillas.includes(c.nombre) ? "(ya agregada)" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {caracteristicaSeleccionada === "tarifa" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar tarifa...</option>
                        {tarifas.map((t) => (
                          <option
                            key={t.id}
                            value={t.nombre}
                            disabled={filtrosTarifas.includes(t.nombre)}
                          >
                            {t.nombre} {filtrosTarifas.includes(t.nombre) ? "(ya agregada)" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    {caracteristicaSeleccionada === "nombre" && (
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Escribí nombre y presioná Enter..."
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            ejecutarAgregarFiltro();
                          }
                        }}
                        autoFocus
                      />
                    )}

                    {caracteristicaSeleccionada === "numero" && (
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Escribí número y presioná Enter..."
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            ejecutarAgregarFiltro();
                          }
                        }}
                        autoFocus
                      />
                    )}

                    {caracteristicaSeleccionada === "depto" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar condición inmueble...</option>
                        <option value="si">🏢 Solo Departamentos / Edificios</option>
                        <option value="no">🏠 Casas / Particulares</option>
                        {OPCIONES_DEPARTAMENTO.map((opc) => (
                          <option key={opc.id} value={String(opc.id)}>
                            {opc.icono} {opc.nombre}
                          </option>
                        ))}
                      </select>
                    )}

                    {caracteristicaSeleccionada === "ubicacion" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar condición Maps...</option>
                        <option value="con_geo">📍 Geolocalizados (Con Maps / GPS)</option>
                        <option value="sin_geo">⚠️ Sin Maps (No encontrados)</option>
                      </select>
                    )}

                    {caracteristicaSeleccionada === "estadoVto" && (
                      <select
                        className="filtro-select"
                        value={valorNuevoFiltro}
                        onChange={(e) => setValorNuevoFiltro(e.target.value)}
                        autoFocus
                      >
                        <option value="">Seleccionar condición Vto...</option>
                        <option value="vencidas">⚠️ Solo Vencidas</option>
                        <option value="por_vencer">⏳ Por Vencer (≤ 7 días)</option>
                        <option value="vigentes">✓ Vigentes / Al día</option>
                        <option value="sin_fecha">— Sin Fecha Asignada</option>
                      </select>
                    )}

                    <button
                      type="button"
                      className="btn-ejecutar-agregar-filtro"
                      onClick={ejecutarAgregarFiltro}
                      disabled={!valorNuevoFiltro.trim()}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Agregar filtro</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="filtros-grid">
              {/* Filtro: Nombre */}
              <div className={`filtro-field ${filtrosNombres.length > 0 || searchName ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-input-nombre">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Nombre
                    {filtrosNombres.length > 0 && (
                      <span className="badge-field-count">({filtrosNombres.length})</span>
                    )}
                  </label>
                  {filtrosNombres.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-nombre"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchName}
                    onChange={handleSearch}
                  />
                  {searchName && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchName("")}
                      aria-label="Limpiar nombre"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filtrosNombres.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosNombres.map((nom) => (
                      <span key={nom} className="field-chip chip-nombre">
                        <span>{nom}</span>
                        <button
                          type="button"
                          onClick={() => removerNombre(nom)}
                          title={`Quitar ${nom}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosNombres([])}
                      title="Limpiar nombres"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Número */}
              <div className={`filtro-field ${filtrosNumeros.length > 0 || searchNumber ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-input-numero">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="9" x2="20" y2="9" />
                      <line x1="4" y1="15" x2="20" y2="15" />
                      <line x1="10" y1="3" x2="8" y2="21" />
                      <line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    N° Usuario
                    {filtrosNumeros.length > 0 && (
                      <span className="badge-field-count">({filtrosNumeros.length})</span>
                    )}
                  </label>
                  {filtrosNumeros.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-numero"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por número..."
                    value={searchNumber}
                    onChange={handleNumber}
                  />
                  {searchNumber && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchNumber("")}
                      aria-label="Limpiar número"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filtrosNumeros.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosNumeros.map((num) => (
                      <span key={num} className="field-chip chip-numero">
                        <span>{num}</span>
                        <button
                          type="button"
                          onClick={() => removerNumero(num)}
                          title={`Quitar ${num}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosNumeros([])}
                      title="Limpiar números"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Domicilio */}
              <div className={`filtro-field ${filtrosDomicilios.length > 0 || searchDomicilio ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-input-domicilio">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Domicilio
                    {filtrosDomicilios.length > 0 && (
                      <span className="badge-field-count">({filtrosDomicilios.length})</span>
                    )}
                  </label>
                  {filtrosDomicilios.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-domicilio"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por domicilio..."
                    value={searchDomicilio}
                    onChange={handleDomicilio}
                  />
                  {searchDomicilio && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchDomicilio("")}
                      aria-label="Limpiar domicilio"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filtrosDomicilios.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosDomicilios.map((dom) => (
                      <span key={dom} className="field-chip chip-domicilio">
                        <span>{dom}</span>
                        <button
                          type="button"
                          onClick={() => removerDomicilio(dom)}
                          title={`Quitar domicilio ${dom}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosDomicilios([])}
                      title="Limpiar domicilios"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Ruta */}
              <div className={`filtro-field ${filtrosRutas.length > 0 || searchRuta ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-input-ruta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                    Ruta
                    {filtrosRutas.length > 0 && (
                      <span className="badge-field-count">({filtrosRutas.length})</span>
                    )}
                  </label>
                  {filtrosRutas.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-ruta"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por ruta..."
                    value={searchRuta}
                    onChange={handleRuta}
                  />
                  {searchRuta && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchRuta("")}
                      aria-label="Limpiar ruta"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filtrosRutas.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosRutas.map((r) => (
                      <span key={r} className="field-chip chip-ruta">
                        <span>{r}</span>
                        <button
                          type="button"
                          onClick={() => removerRuta(r)}
                          title={`Quitar ruta ${r}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosRutas([])}
                      title="Limpiar rutas"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Cuadrilla */}
              <div className={`filtro-field ${filtrosCuadrillas.length > 0 || searchCuadrilla ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-select-cuadrilla">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Cuadrilla
                    {filtrosCuadrillas.length > 0 && (
                      <span className="badge-field-count">({filtrosCuadrillas.length})</span>
                    )}
                  </label>
                  {filtrosCuadrillas.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-cuadrilla"
                    className="filtro-select"
                    value={searchCuadrilla}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        agregarCuadrilla(val);
                      }
                    }}
                  >
                    <option value="">➕ Seleccionar cuadrilla para agregar...</option>
                    {cuadrillas.map((cuadrilla) => (
                      <option
                        key={cuadrilla.id}
                        value={cuadrilla.nombre}
                        disabled={filtrosCuadrillas.includes(cuadrilla.nombre)}
                      >
                        {cuadrilla.nombre} {filtrosCuadrillas.includes(cuadrilla.nombre) ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {filtrosCuadrillas.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosCuadrillas.map((c) => (
                      <span key={c} className="field-chip chip-cuadrilla">
                        <span>{c}</span>
                        <button
                          type="button"
                          onClick={() => removerCuadrilla(c)}
                          title={`Quitar cuadrilla ${c}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosCuadrillas([])}
                      title="Limpiar cuadrillas"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Estados (Soporta múltiples estados simultáneos) */}
              <div className={`filtro-field ${filtrosEstados.length > 0 || searchEstados ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-select-estado">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 14 14" />
                    </svg>
                    Estado
                    {filtrosEstados.length > 0 && (
                      <span className="badge-field-count">({filtrosEstados.length})</span>
                    )}
                  </label>
                  {filtrosEstados.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>

                {/* Selector rápido Departamento vs Independiente arriba del estado */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "6px" }}>
                  <button
                    type="button"
                    style={{
                      padding: "4px 6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "1.5px solid",
                      cursor: "pointer",
                      borderColor: !searchDepto ? "#2563eb" : "#e2e8f0",
                      background: !searchDepto ? "#eff6ff" : "#ffffff",
                      color: !searchDepto ? "#1d4ed8" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setSearchDepto("")}
                    title="Mostrar todos los tipos de inmuebles"
                  >
                    🌐 Todos
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "4px 6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "1.5px solid",
                      cursor: "pointer",
                      borderColor: searchDepto === "si" ? "#2563eb" : "#e2e8f0",
                      background: searchDepto === "si" ? "#eff6ff" : "#ffffff",
                      color: searchDepto === "si" ? "#1d4ed8" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setSearchDepto(searchDepto === "si" ? "" : "si")}
                    title="Filtrar únicamente Departamentos / Edificios"
                  >
                    🏢 Deptos
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "4px 6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "1.5px solid",
                      cursor: "pointer",
                      borderColor: searchDepto === "no" ? "#2563eb" : "#e2e8f0",
                      background: searchDepto === "no" ? "#eff6ff" : "#ffffff",
                      color: searchDepto === "no" ? "#1d4ed8" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setSearchDepto(searchDepto === "no" ? "" : "no")}
                    title="Filtrar únicamente Casas / Independientes"
                  >
                    🏠 Indep.
                  </button>
                </div>

                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-estado"
                    className="filtro-select"
                    value={searchEstados}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        agregarEstado(val);
                      }
                    }}
                  >
                    <option value="">➕ Seleccionar estado para agregar...</option>
                    {estados
                      .filter((estado) => !IDS_DEPARTAMENTO.includes(estado.id))
                      .map((estado) => (
                        <option
                          key={estado.id}
                          value={estado.nombre}
                          disabled={filtrosEstados.includes(estado.nombre)}
                        >
                          {estado.nombre} {filtrosEstados.includes(estado.nombre) ? "✓" : ""}
                        </option>
                      ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {filtrosEstados.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosEstados.map((est) => (
                      <span key={est} className="field-chip chip-estado">
                        <span>{est}</span>
                        <button
                          type="button"
                          onClick={() => removerEstado(est)}
                          title={`Quitar estado ${est}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosEstados([])}
                      title="Limpiar estados"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtro: Tarifas */}
              <div className={`filtro-field ${filtrosTarifas.length > 0 || searchTarifas ? "has-value" : ""}`}>
                <div className="filtro-field-header">
                  <label htmlFor="filtro-select-tarifa">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Tarifa
                    {filtrosTarifas.length > 0 && (
                      <span className="badge-field-count">({filtrosTarifas.length})</span>
                    )}
                  </label>
                  {filtrosTarifas.length > 1 && (
                    <span className="filtro-field-mode">Cualquiera (OR)</span>
                  )}
                </div>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-tarifa"
                    className="filtro-select"
                    value={searchTarifas}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        agregarTarifa(val);
                        if (!esTarifaComercial(val) && !filtrosTarifas.some(esTarifaComercial)) {
                          setSearchRubroComercio("");
                          setSearchNombreComercio("");
                        }
                      }
                    }}
                  >
                    <option value="">➕ Seleccionar tarifa para agregar...</option>
                    {tarifas.map((tarifa) => (
                      <option
                        key={tarifa.id}
                        value={tarifa.nombre}
                        disabled={filtrosTarifas.includes(tarifa.nombre)}
                      >
                        {tarifa.nombre} {filtrosTarifas.includes(tarifa.nombre) ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {filtrosTarifas.length > 0 && (
                  <div className="field-chips-container">
                    {filtrosTarifas.map((tar) => (
                      <span key={tar} className="field-chip chip-tarifa">
                        <span>{tar}</span>
                        <button
                          type="button"
                          onClick={() => removerTarifa(tar)}
                          title={`Quitar tarifa ${tar}`}
                          className="chip-remove"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className="chip-clear-all"
                      onClick={() => setFiltrosTarifas([])}
                      title="Limpiar tarifas"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtros condicionales de Comercio: Solo visibles si la tarifa es T1G o T1G-I */}
              {esFiltroTarifaComercial && (
                <>
                  <div className={`filtro-field ${searchRubroComercio ? "has-value" : ""}`} style={{ borderColor: "#0284c7" }}>
                    <label htmlFor="filtro-select-rubro">
                      <span style={{ fontSize: "15px", marginRight: "3px" }}>🏪</span>
                      Tipo de Comercio
                    </label>
                    <div className="select-dropdown-wrap">
                      <select
                        id="filtro-select-rubro"
                        className="filtro-select"
                        value={searchRubroComercio}
                        onChange={(e) => setSearchRubroComercio(e.target.value)}
                        style={{ color: searchRubroComercio ? "#0369a1" : undefined }}
                      >
                        <option value="">Todos los tipos de comercio</option>
                        {TIPOS_COMERCIO.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="select-chevron-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  <div className={`filtro-field ${searchNombreComercio ? "has-value" : ""}`} style={{ borderColor: "#0284c7" }}>
                    <label htmlFor="filtro-input-nombre-comercio">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      Nombre Informal Comercio
                    </label>
                    <div className="filtro-input-wrap">
                      <input
                        id="filtro-input-nombre-comercio"
                        className="search-input"
                        type="text"
                        placeholder="Ej: Carnicería El Abasto..."
                        value={searchNombreComercio}
                        onChange={(e) => setSearchNombreComercio(e.target.value)}
                      />
                      {searchNombreComercio && (
                        <button
                          type="button"
                          className="btn-field-clear"
                          onClick={() => setSearchNombreComercio("")}
                          aria-label="Limpiar nombre informal"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Filtro: Tipo Inmueble / Departamento */}
              <div className={`filtro-field ${searchDepto ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-depto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <line x1="9" y1="22" x2="9" y2="22.01" />
                    <line x1="15" y1="22" x2="15" y2="22.01" />
                    <line x1="9" y1="6" x2="9" y2="6.01" />
                    <line x1="15" y1="6" x2="15" y2="6.01" />
                    <line x1="9" y1="10" x2="9" y2="10.01" />
                    <line x1="15" y1="10" x2="15" y2="10.01" />
                    <line x1="9" y1="14" x2="9" y2="14.01" />
                    <line x1="15" y1="14" x2="15" y2="14.01" />
                  </svg>
                  Inmueble / Llave
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-depto"
                    className="filtro-select"
                    value={searchDepto}
                    onChange={(e) => setSearchDepto(e.target.value)}
                  >
                    <option value="">Todos los inmuebles</option>
                    <option value="si">🏢 Solo Departamentos / Edificios</option>
                    <option value="no">🏠 Casas / Particulares</option>
                    <optgroup label="Por Condición de Llave">
                      {OPCIONES_DEPARTAMENTO.map((opc) => (
                        <option key={opc.id} value={String(opc.id)}>
                          {opc.icono} {opc.nombre} (ID: #{opc.id})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Filtro: Estado de Geolocalización (Maps) */}
              <div className={`filtro-field ${searchUbicacion ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-ubicacion">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Geolocalización / Maps
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-ubicacion"
                    className="filtro-select"
                    value={searchUbicacion}
                    onChange={(e) => setSearchUbicacion(e.target.value)}
                  >
                    <option value="">Todas las ubicaciones</option>
                    <option value="con_geo">📍 Geolocalizados (Con Maps / GPS)</option>
                    <option value="sin_geo">⚠️ Sin Maps (No encontrados en Maps)</option>
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Filtro: Estado de Vencimiento */}
              <div className={`filtro-field ${searchEstadoVto ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-estadovto">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Estado Fecha Vto
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-estadovto"
                    className="filtro-select"
                    value={searchEstadoVto}
                    onChange={(e) => setSearchEstadoVto(e.target.value)}
                  >
                    <option value="">Todas las condiciones</option>
                    <option value="vencidas">⚠️ Solo Vencidas</option>
                    <option value="por_vencer">⏳ Por Vencer (≤ 7 días)</option>
                    <option value="vigentes">✓ Vigentes / Al día</option>
                    <option value="sin_fecha">— Sin Fecha Asignada</option>
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Filtro: Fecha Vto Desde */}
              <div className={`filtro-field ${searchVtoDesde ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-vtodesde">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Vto Desde
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-vtodesde"
                    className="search-input"
                    type="date"
                    value={searchVtoDesde}
                    onChange={(e) => setSearchVtoDesde(e.target.value)}
                  />
                  {searchVtoDesde && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchVtoDesde("")}
                      aria-label="Limpiar fecha desde"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro: Fecha Vto Hasta */}
              <div className={`filtro-field ${searchVtoHasta ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-vtohasta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Vto Hasta
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-vtohasta"
                    className="search-input"
                    type="date"
                    value={searchVtoHasta}
                    onChange={(e) => setSearchVtoHasta(e.target.value)}
                  />
                  {searchVtoHasta && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchVtoHasta("")}
                      aria-label="Limpiar fecha hasta"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="filtros-footer">
              <span className="filtros-count-indicator">
                Mostrando <strong>{filteredUsers.length}</strong> de <strong>{allUsers.length}</strong> usuarios
              </span>
              <div className="filtros-footer-buttons">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="btn-footer-clear"
                    onClick={limpiarFiltros}
                  >
                    Limpiar todo
                  </button>
                )}
                <button
                  type="button"
                  className="btn-footer-close"
                  onClick={() => setMostrarFiltros(false)}
                >
                  Cerrar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Chips de filtros activos */}
          <div className="filtros-status-bar">
            <div className="filtros-status-count">
              <span>{filteredUsers.length} {filteredUsers.length === 1 ? "usuario encontrado" : "usuarios encontrados"}</span>
            </div>

            {activeFiltersCount > 0 && (
              <div className="filtros-active-chips">
                {/* Nombres */}
                {filtrosNombres.map((nom) => (
                  <span key={`chip-nom-${nom}`} className="filtro-chip">
                    Nombre: <strong>{nom}</strong>
                    <button type="button" onClick={() => removerNombre(nom)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchName && !filtrosNombres.includes(searchName.trim()) && (
                  <span className="filtro-chip">
                    Nombre: <strong>{searchName}</strong>
                    <button type="button" onClick={() => setSearchName("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Números */}
                {filtrosNumeros.map((num) => (
                  <span key={`chip-num-${num}`} className="filtro-chip">
                    N°: <strong>{num}</strong>
                    <button type="button" onClick={() => removerNumero(num)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchNumber && !filtrosNumeros.includes(searchNumber.trim()) && (
                  <span className="filtro-chip">
                    N°: <strong>{searchNumber}</strong>
                    <button type="button" onClick={() => setSearchNumber("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Domicilios (Múltiples) */}
                {filtrosDomicilios.map((dom) => (
                  <span key={`chip-dom-${dom}`} className="filtro-chip chip-highlight-domicilio">
                    Domicilio: <strong>{dom}</strong>
                    <button type="button" onClick={() => removerDomicilio(dom)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchDomicilio && !filtrosDomicilios.some(d => d.toLowerCase() === searchDomicilio.trim().toLowerCase()) && (
                  <span className="filtro-chip chip-highlight-domicilio">
                    Domicilio: <strong>{searchDomicilio}</strong>
                    <button type="button" onClick={() => setSearchDomicilio("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Rutas (Múltiples) */}
                {filtrosRutas.map((ruta) => (
                  <span key={`chip-ruta-${ruta}`} className="filtro-chip chip-highlight-ruta">
                    Ruta: <strong>{ruta}</strong>
                    <button type="button" onClick={() => removerRuta(ruta)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchRuta && !filtrosRutas.some(r => r.toLowerCase() === searchRuta.trim().toLowerCase()) && (
                  <span className="filtro-chip chip-highlight-ruta">
                    Ruta: <strong>{searchRuta}</strong>
                    <button type="button" onClick={() => setSearchRuta("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Cuadrillas (Múltiples) */}
                {filtrosCuadrillas.map((cuad) => (
                  <span key={`chip-cuad-${cuad}`} className="filtro-chip chip-highlight-cuadrilla">
                    Cuadrilla: <strong>{cuad}</strong>
                    <button type="button" onClick={() => removerCuadrilla(cuad)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchCuadrilla && !filtrosCuadrillas.includes(searchCuadrilla) && (
                  <span className="filtro-chip chip-highlight-cuadrilla">
                    Cuadrilla: <strong>{searchCuadrilla}</strong>
                    <button type="button" onClick={() => setSearchCuadrilla("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Estados (Múltiples) */}
                {filtrosEstados.map((est) => (
                  <span key={`chip-est-${est}`} className="filtro-chip chip-highlight-estado">
                    Estado: <strong>{est}</strong>
                    <button type="button" onClick={() => removerEstado(est)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchEstados && !filtrosEstados.includes(searchEstados) && (
                  <span className="filtro-chip chip-highlight-estado">
                    Estado: <strong>{searchEstados}</strong>
                    <button type="button" onClick={() => setSearchEstados("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Tarifas (Múltiples) */}
                {filtrosTarifas.map((tar) => (
                  <span key={`chip-tar-${tar}`} className="filtro-chip chip-highlight-tarifa">
                    Tarifa: <strong>{tar}</strong>
                    <button type="button" onClick={() => removerTarifa(tar)} title="Quitar filtro">×</button>
                  </span>
                ))}
                {searchTarifas && !filtrosTarifas.includes(searchTarifas) && (
                  <span className="filtro-chip chip-highlight-tarifa">
                    Tarifa: <strong>{searchTarifas}</strong>
                    <button type="button" onClick={() => setSearchTarifas("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Filtro Comercio */}
                {esFiltroTarifaComercial && searchRubroComercio && (
                  <span className="filtro-chip">
                    Rubro: <strong>{searchRubroComercio}</strong>
                    <button type="button" onClick={() => setSearchRubroComercio("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {esFiltroTarifaComercial && searchNombreComercio && (
                  <span className="filtro-chip">
                    Comercio: <strong>{searchNombreComercio}</strong>
                    <button type="button" onClick={() => setSearchNombreComercio("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Inmueble */}
                {searchDepto && (
                  <span className="filtro-chip">
                    Inmueble: <strong>
                      {searchDepto === "si"
                        ? "Edificios/Deptos"
                        : searchDepto === "no"
                        ? "Casas/Particulares"
                        : OPCIONES_DEPARTAMENTO.find((o) => String(o.id) === searchDepto)?.nombre || searchDepto}
                    </strong>
                    <button type="button" onClick={() => setSearchDepto("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Vencimiento */}
                {searchEstadoVto && (
                  <span className="filtro-chip">
                    Vto: <strong>
                      {searchEstadoVto === "vencidas"
                        ? "Vencidas"
                        : searchEstadoVto === "por_vencer"
                        ? "Por vencer"
                        : searchEstadoVto === "vigentes"
                        ? "Vigentes"
                        : "Sin fecha"}
                    </strong>
                    <button type="button" onClick={() => setSearchEstadoVto("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchVtoDesde && (
                  <span className="filtro-chip">
                    Vto Desde: <strong>{searchVtoDesde}</strong>
                    <button type="button" onClick={() => setSearchVtoDesde("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchVtoHasta && (
                  <span className="filtro-chip">
                    Vto Hasta: <strong>{searchVtoHasta}</strong>
                    <button type="button" onClick={() => setSearchVtoHasta("")} title="Quitar filtro">×</button>
                  </span>
                )}

                {/* Ubicación */}
                {searchUbicacion && (
                  <span className="filtro-chip">
                    Ubicación: <strong>
                      {searchUbicacion === "con_geo" ? "📍 Con Maps" : "⚠️ Sin Maps (No encontrado)"}
                    </strong>
                    <button type="button" onClick={() => setSearchUbicacion("")} title="Quitar filtro">×</button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mensaje de no resultados */}
        {!cargando && filteredUsers.length === 0 && (
          <div className="empty-results-box">
            <div className="empty-results-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <h4>No se encontraron usuarios</h4>
            <p>No existen registros que coincidan con los criterios de búsqueda aplicados.</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn-empty-reset"
                onClick={limpiarFiltros}
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}

        {/* Indicador de carga */}
        {cargando && (
          <div className="loading-usuarios-box">
            <div className="spinner-large"></div>
            <h4>Cargando usuarios...</h4>
            <p>Consultando los registros en la base de datos de forma optimizada.</p>
          </div>
        )}

        {/* Barra superior de paginación y controles */}
        {!cargando && filteredUsers.length > 0 && (
          <div className="pagination-top-bar" id="seccion-lista-usuarios">
            <div className="pagination-info">
              Mostrando <strong>{indexInicio + 1}–{indexFin}</strong> de <strong>{totalUsuariosFiltrados.toLocaleString()}</strong> usuarios
              {totalPaginas > 1 && (
                <span className="pagina-indicator-badge">Página {paginaActual} de {totalPaginas}</span>
              )}
            </div>

            <div className="pagination-options">
              <label htmlFor="select-por-pagina">Filas por página:</label>
              <select
                id="select-por-pagina"
                className="select-por-pagina"
                value={porPagina}
                onChange={(e) => setPorPagina(Number(e.target.value))}
              >
                <option value={25}>25 usuarios</option>
                <option value={50}>50 usuarios (recomendado)</option>
                <option value={100}>100 usuarios</option>
                <option value={200}>200 usuarios</option>
              </select>
            </div>
          </div>
        )}

        {/* Lista Vertical de Usuarios (Solo dibuja la página actual para máximo rendimiento) */}
        {!cargando && (
          <section className="user-list-container">
            {usuariosPaginados.map((user) => {
              const sinGeo = !user.latitud || !user.longitud;
              return (
              <div className={`user-list-card ${sinGeo ? "sin-geolocalizacion" : ""}`} key={user.id}>

              {/* 1. CABECERA DE LA TARJETA */}
              <div className="user-card-header">
                <div className="user-card-header-left">
                  <span className="badge-user-nro">N° {user.nroUsuario}</span>
                  <h4 className="user-card-name">{user.nombre}</h4>
                  {(() => {
                    if (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id)) {
                      return null;
                    }
                    const badgeInfo = getEstadoBadgeInfo(user.estado);
                    return (
                      <span className={`badge-user-estado ${badgeInfo.badgeClass}`}>
                        <span className={`estado-bullet ${badgeInfo.bulletClass}`}></span>
                        {badgeInfo.nombre}
                      </span>
                    );
                  })()}
                  {/* BADGE SEÑALIZADOR DE SIN UBICACIÓN */}
                  {sinGeo && (
                    <span className="badge-sin-ubicacion" title="Este usuario no cuenta con coordenadas GPS / No fue encontrado en Maps">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Sin Maps</span>
                    </span>
                  )}
                  {/* BADGE DEPARTAMENTO EN CHIQUITO EN LA CARD */}
                  {(user.esDepartamento || user.idEstadoDepto || user.estadoDepto || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id))) && (
                    <span
                      className="badge-depto-mini"
                      title={`Departamento: ${user.estadoDepto?.nombre || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id) ? user.estado.nombre : null) || OPCIONES_DEPARTAMENTO.find((o) => o.id === user.idEstadoDepto)?.nombre || "Asignado"}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="9" y1="22" x2="9" y2="22.01" />
                        <line x1="15" y1="22" x2="15" y2="22.01" />
                        <line x1="9" y1="6" x2="9" y2="6.01" />
                        <line x1="15" y1="6" x2="15" y2="6.01" />
                        <line x1="9" y1="10" x2="9" y2="10.01" />
                        <line x1="15" y1="10" x2="15" y2="10.01" />
                        <line x1="9" y1="14" x2="9" y2="14.01" />
                        <line x1="15" y1="14" x2="15" y2="14.01" />
                        <line x1="9" y1="18" x2="9" y2="18.01" />
                        <line x1="15" y1="18" x2="15" y2="18.01" />
                      </svg>
                      <span className="depto-mini-text">
                        {user.estadoDepto?.nombre ||
                          (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id) ? user.estado.nombre : null) ||
                          OPCIONES_DEPARTAMENTO.find((o) => o.id === user.idEstadoDepto)?.nombre ||
                          "DEPTO"}
                      </span>
                      {(user.idEstadoDepto || user.estadoDepto?.id || (user.estado && IDS_DEPARTAMENTO.includes(user.estado.id) ? user.estado.id : null)) && (
                        <span className="depto-mini-id">
                          #{user.idEstadoDepto || user.estadoDepto?.id || user.estado?.id}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* BLOQUE DESTACADO DE VENCIMIENTO CON CUENTA REGRESIVA */}
                <div className="user-card-header-vto">
                  <span className="vto-mini-label">VENCIMIENTO / PAGO</span>
                  {(() => {
                    const infoVto = obtenerInfoVencimiento(user.fechaVto);
                    if (infoVto.estado === "sin_fecha") {
                      return <span className="val-vto-sin-fecha">— Sin fecha asignada</span>;
                    }
                    let badgeClass = "val-vto-vigente";
                    let icon = null;
                    if (infoVto.estado === "vencida") {
                      badgeClass = "val-vto-vencida";
                      icon = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      );
                    } else if (infoVto.estado === "vence_hoy") {
                      badgeClass = "val-vto-vence-hoy";
                      icon = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="12 6 12 12 16 14" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      );
                    } else if (infoVto.estado === "por_vencer") {
                      badgeClass = "val-vto-por-vencer";
                      icon = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="12 6 12 12 16 14" />
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                      );
                    } else {
                      icon = (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 14 14" />
                        </svg>
                      );
                    }

                    return (
                      <span className={`val-vto-container ${badgeClass}`} title={infoVto.subtexto || infoVto.texto}>
                        {icon}
                        <span>{infoVto.texto}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="user-card-header-actions">
                  <button
                    type="button"
                    className="btn-card-action btn-edit"
                    onClick={() => abrirPopupEdit(user.id)}
                    title="Editar usuario"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    className="btn-card-action btn-delete"
                    onClick={() => setUsuarioAEliminar(user)}
                    title="Eliminar usuario"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Eliminar</span>
                  </button>

                  <button
                    type="button"
                    className="btn-card-action btn-images"
                    onClick={() => abrirPopup(user.id)}
                    title="Ver fotos registradas"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                    <span>Fotos</span>
                  </button>
                </div>
              </div>

              {/* 2. CUERPO: ATRIBUTOS BIEN DISTINGUIDOS EN CASILLAS */}
              <div className="user-card-body">
                {/* Domicilio */}
                <div className="attr-tile">
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>Domicilio</span>
                  </div>
                  <div className="attr-tile-value">
                    {user.domicilio ? (
                      <span className="badge-attr-domicilio">{user.domicilio}</span>
                    ) : (
                      <span className="val-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Medidor */}
                <div className="attr-tile">
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="2" y="2" width="20" height="20" rx="4" />
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="2" x2="12" y2="5" />
                    </svg>
                    <span>N° Medidor (1:1)</span>
                  </div>
                  <div className="attr-tile-value">
                    {user.medidor ? (
                      <span className="badge-attr-medidor">{user.medidor}</span>
                    ) : (
                      <span className="val-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Ruta / Sector */}
                <div className="attr-tile">
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <span>Ruta / Sector</span>
                  </div>
                  <div className="attr-tile-value">
                    {user.ruta ? (
                      <span className="badge-attr-ruta">{user.ruta}</span>
                    ) : (
                      <span className="val-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Tarifa */}
                <div className="attr-tile">
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span>Tarifa</span>
                  </div>
                  <div className="attr-tile-value">
                    {user.tarifa?.nombre ? (
                      <span className="badge-attr-tarifa">{user.tarifa.nombre}</span>
                    ) : (
                      <span className="val-muted">—</span>
                    )}
                  </div>
                </div>

                {/* Cuadrillas Asignadas */}
                <div className="attr-tile attr-tile-wide">
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Cuadrillas Asignadas</span>
                  </div>
                  <div className="attr-tile-value attr-chips-wrap">
                    {user.cuadrillas && user.cuadrillas.length > 0 ? (
                      user.cuadrillas.map((c) => (
                        <span key={c.id} className="chip-cuadrilla-modern">{c.nombre}</span>
                      ))
                    ) : (
                      <span className="val-muted">— Sin cuadrillas</span>
                    )}
                  </div>
                </div>

                {/* Ubicación Google Maps / Georreferenciada */}
                <div className={`attr-tile ${sinGeo ? "attr-tile-alerta-sin-geo" : ""}`}>
                  <div className="attr-tile-title">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Ubicación</span>
                  </div>
                  <div className="attr-tile-value" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {!sinGeo ? (
                      <a
                        href={user.maps || `https://www.google.com/maps?q=${user.latitud},${user.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="maps-link-modern"
                        title={`Coordenadas en Zárate: ${user.latitud}, ${user.longitud}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>Ver Punto</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ) : (
                      <div className="alerta-sin-maps-badge" title="No se encontró la dirección en Google Maps o no posee coordenadas">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                        <span>No encontrado en Maps</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. OBSERVACIONES AL PIE CON MENÚ DESPLEGABLE SI SON MÁS DE 1 */}
              {user.observaciones && (
                <div className="user-card-obs">
                  {(() => {
                    const parsed = parsearObservaciones(user.observaciones);
                    
                    if (parsed.length === 0) {
                      return (
                        <>
                          <div className="obs-tag">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
                            </svg>
                            <span>OBSERVACIONES:</span>
                          </div>
                          <span className="obs-content">{user.observaciones}</span>
                        </>
                      );
                    }

                    // Caso de 1 sola observación: se muestra directa y compacta
                    if (parsed.length === 1) {
                      const obs = parsed[0];
                      return (
                        <>
                          <div className="obs-tag">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
                            </svg>
                            <span>OBSERVACIÓN:</span>
                          </div>
                          <div className="obs-single-entry" style={{ flex: 1 }}>
                            <span className="obs-entry-text">{obs.texto}</span>
                            <span className="obs-entry-date">📅 {obs.fecha}</span>
                          </div>
                        </>
                      );
                    }

                    // Caso de más de 1 observación: Menú desplegable para no hacer cards gigantes
                    return (
                      <details className="obs-dropdown-menu">
                        <summary className="obs-dropdown-summary">
                          <div className="obs-dropdown-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
                            </svg>
                            <span>OBSERVACIONES ({parsed.length})</span>
                          </div>
                          <span className="obs-dropdown-btn">
                            Ver historial ({parsed.length})
                            <svg className="obs-dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </summary>
                        <div className="obs-dropdown-content">
                          <div className="obs-items-list">
                            {parsed.map((obs, idx) => (
                              <div key={obs.id || idx} className="obs-single-entry obs-entry-bordered">
                                <span className="obs-entry-num">Obs {idx + 1}:</span>
                                <span className="obs-entry-text">{obs.texto}</span>
                                <span className="obs-entry-date">📅 {obs.fecha}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    );
                  })()}
                </div>
              )}

            </div>
              );
            })}
        </section>
        )}

        {/* Barra inferior de paginación completa */}
        {!cargando && totalPaginas > 1 && (
          <div className="pagination-bottom-container">
            <div className="pagination-nav">
              <button
                type="button"
                className="btn-page-nav"
                onClick={() => cambiarPagina(1)}
                disabled={paginaActual === 1}
                title="Primera página"
              >
                « Primera
              </button>
              <button
                type="button"
                className="btn-page-nav"
                onClick={() => cambiarPagina(paginaActual - 1)}
                disabled={paginaActual === 1}
                title="Página anterior"
              >
                ‹ Anterior
              </button>

              <div className="page-numbers-group">
                {generarBotonesPaginacion().map((item, idx) => {
                  if (item === "...") {
                    return <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>;
                  }
                  const num = item as number;
                  return (
                    <button
                      key={num}
                      type="button"
                      className={`btn-page-number ${paginaActual === num ? "active" : ""}`}
                      onClick={() => cambiarPagina(num)}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-page-nav"
                onClick={() => cambiarPagina(paginaActual + 1)}
                disabled={paginaActual === totalPaginas}
                title="Página siguiente"
              >
                Siguiente ›
              </button>
              <button
                type="button"
                className="btn-page-nav"
                onClick={() => cambiarPagina(totalPaginas)}
                disabled={paginaActual === totalPaginas}
                title="Última página"
              >
                Última »
              </button>
            </div>

            <div className="page-jump-box">
              <span>Ir a página:</span>
              <input
                type="number"
                min={1}
                max={totalPaginas}
                value={inputSalto}
                onChange={(e) => setInputSalto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Number(inputSalto);
                    if (val >= 1 && val <= totalPaginas) {
                      cambiarPagina(val);
                      setInputSalto("");
                    }
                  }
                }}
                placeholder={`${paginaActual}`}
                className="input-page-jump"
              />
              <button
                type="button"
                className="btn-page-jump"
                onClick={() => {
                  const val = Number(inputSalto);
                  if (val >= 1 && val <= totalPaginas) {
                    cambiarPagina(val);
                    setInputSalto("");
                  }
                }}
              >
                Ir
              </button>
            </div>
          </div>
        )}

          {/* Modal Ver Imágenes */}
          {showPopup && usuarioSeleccionado && (
            <div className="popup-overlay" onClick={cerrarPopup}>
              <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <Popup
                  imagenes={imagenes}
                  setImagenes={setImagenes}
                  usuarioId={usuarioSeleccionado.id}
                />
                <button className="close-button" onClick={cerrarPopup}>
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Modal Editar Usuario */}
          {showPopupEdit && usuarioSeleccionado && (
            <div className="popup-overlay" onClick={cerrarPopupEdit}>
              <div
                className="popup-content popup-edit-content"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="modal-close-icon"
                  onClick={cerrarPopupEdit}
                  title="Cerrar modal"
                  aria-label="Cerrar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <PopupEdit
                  usuarioId={usuarioSeleccionado.id}
                  onClose={cerrarPopupEdit}
                  onUserUpdated={() => {
                    fetchAllUsers();
                    cerrarPopupEdit();
                  }}
                />
              </div>
            </div>
          )}

          {/* Modal Eliminar Usuario */}
          {usuarioAEliminar && (
            <div
              className="popup-overlay"
              onClick={() => !eliminando && setUsuarioAEliminar(null)}
            >
              <div
                className="popup-content delete-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="delete-modal-header">
                  <div className="delete-modal-icon">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h3 className="delete-modal-title">¿Eliminar usuario?</h3>
                  <p className="delete-modal-text">
                    Estás a punto de eliminar a <strong>&quot;{usuarioAEliminar.nombre}&quot;</strong> (Nro: #{usuarioAEliminar.nroUsuario}).
                    Esta acción no se puede deshacer y borrará también sus imágenes registradas.
                  </p>
                </div>

                <div className="delete-modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setUsuarioAEliminar(null)}
                    disabled={eliminando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-confirm-delete"
                    onClick={ejecutarEliminar}
                    disabled={eliminando}
                  >
                    {eliminando ? (
                      <>
                        <span className="spinner" style={{ width: 14, height: 14 }}></span>
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Sí, eliminar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Selección de Características para Exportar Excel */}
          {showModalExport && (
            <div className="modal-export-overlay" onClick={() => setShowModalExport(false)}>
              <div className="modal-export-card" onClick={(e) => e.stopPropagation()}>
                {/* Cabecera del Modal */}
                <div className="modal-export-header">
                  <div className="modal-export-header-left">
                    <div className="modal-export-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ffffff" fillOpacity="0.25"/>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#ffffff" strokeWidth="2"/>
                        <path d="M14 2v6h6" stroke="#ffffff" strokeWidth="2"/>
                        <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="modal-export-title-block">
                      <h4>Exportar a Planilla Excel</h4>
                      <p className="modal-export-subtitle">
                        Elige qué características incluir para los <strong>{filteredUsers.length}</strong> usuarios filtrados
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-modal-close-icon"
                    onClick={() => setShowModalExport(false)}
                    title="Cerrar ventana"
                  >
                    ✕
                  </button>
                </div>

                {/* Barra rápida de selección */}
                <div className="modal-export-quick-bar">
                  <div className="quick-bar-left">
                    <button
                      type="button"
                      className="btn-quick-select"
                      onClick={seleccionarTodasColumnas}
                    >
                      ✓ Seleccionar todas
                    </button>
                    <button
                      type="button"
                      className="btn-quick-select"
                      onClick={deseleccionarTodasColumnas}
                    >
                      ✕ Deseleccionar todas
                    </button>
                  </div>
                  <span className="quick-bar-counter">
                    {columnasSeleccionadas.length} de {COLUMNAS_EXPORTAR.length} seleccionadas
                  </span>
                </div>

                {/* Lista de características agrupadas */}
                <div className="modal-export-body">
                  {/* Opción de diseño / coloreado por estado */}
                  <div className="export-styling-card">
                    <label className={`export-styling-toggle ${pintarFilasPorEstado ? "is-active" : ""}`}>
                      <div className="styling-toggle-left">
                        <div className="styling-toggle-icon">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"/>
                          </svg>
                        </div>
                        <div className="styling-toggle-info">
                          <div className="styling-toggle-title-row">
                            <span className="styling-toggle-title">Pintar cada fila con el color del estado</span>
                            {pintarFilasPorEstado && (
                              <span className="badge-styling-active">Activado</span>
                            )}
                          </div>
                          <span className="styling-toggle-desc">
                            Aplica a cada fila en el Excel su fondo característico (Corte en rojo, Reconectado en azul, Fraude en verde, etc.)
                          </span>
                        </div>
                      </div>
                      <div className="styling-switch-wrapper">
                        <input
                          type="checkbox"
                          className="styling-switch-checkbox"
                          checked={pintarFilasPorEstado}
                          onChange={(e) => setPintarFilasPorEstado(e.target.checked)}
                        />
                        <span className="styling-switch-slider"></span>
                      </div>
                    </label>
                  </div>

                  {GRUPOS_COLUMNAS.map((grupo) => (
                    <div key={grupo} className="export-group-card">
                      <div className="export-group-title">{grupo}</div>
                      <div className="export-chips-grid">
                        {COLUMNAS_EXPORTAR.filter((c) => c.grupo === grupo).map((col) => {
                          const isSelected = columnasSeleccionadas.includes(col.id);
                          return (
                            <label
                              key={col.id}
                              className={`export-chip-item ${isSelected ? "is-selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                className="export-chip-checkbox"
                                checked={isSelected}
                                onChange={() => toggleColumna(col.id)}
                              />
                              <span>{col.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pie del modal con confirmación */}
                <div className="modal-export-footer">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => setShowModalExport(false)}
                    disabled={exportandoExcel}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-modal-confirm-export"
                    onClick={confirmarExportacionExcel}
                    disabled={columnasSeleccionadas.length === 0 || exportandoExcel}
                  >
                    {exportandoExcel ? (
                      <>
                        <span className="export-spinner" />
                        <span>Generando planilla...</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ffffff" fillOpacity="0.25"/>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#ffffff" strokeWidth="2"/>
                          <path d="M14 2v6h6" stroke="#ffffff" strokeWidth="2"/>
                          <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round"/>
                        </svg>
                        <span>Descargar Excel ({columnasSeleccionadas.length} col.)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
