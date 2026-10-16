"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "../css/mapa.css";
import { obtenerInfoVencimiento } from "@/lib/vencimiento";
import { ESTADOS_MAPA_CONFIG, obtenerConfigEstadoPorUsuario } from "@/lib/estadoColors";
import {
  calcularRutaOptimaCortes,
  construirRutaManual,
  ResultadoRuta,
  generarUrlGoogleMapsRuta,
  formatearDistancia,
  obtenerRutaPorCalles,
  aplicarRutaPorCalles,
} from "@/lib/rutaOptima";
import { descargarExcelRutaOperativo } from "@/lib/exportarRutaExcel";
import { exportarMapaKML } from "@/lib/exportarMapaVisor";
import { toast } from "react-toastify";
import { normalizarDireccionBase, tieneCheckEdificio } from "@/lib/domicilioUtils";
import { getValidImageUrl } from "@/lib/imageUtils";

const ZARATE_CENTER: [number, number] = [-34.0964, -59.0289];
const DEFAULT_ZOOM = 13;

// Rutas válidas según normativa operativa: 1 a 78, 201 a 212, 301, 302 y 303
export const RUTAS_VALIDAS_LISTA: number[] = [
  ...Array.from({ length: 78 }, (_, i) => i + 1), // 1..78
  ...Array.from({ length: 12 }, (_, i) => 201 + i), // 201..212
  301,
  302,
  303,
];

export function esRutaValida(valor: string | number): boolean {
  if (valor === "" || valor === null || valor === undefined) return false;
  const num = typeof valor === "number" ? valor : parseInt(String(valor).trim(), 10);
  if (isNaN(num)) return false;
  return (
    (num >= 1 && num <= 78) ||
    (num >= 201 && num <= 212) ||
    num === 301 ||
    num === 302 ||
    num === 303
  );
}

export function normalizarRuta(rutaStr: string | null | undefined): string {
  if (!rutaStr) return "";
  const num = parseInt(String(rutaStr).trim(), 10);
  return isNaN(num) ? String(rutaStr).trim() : String(num);
}

interface UsuarioGeo {
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
  maps?: string | null;
  esDepartamento?: boolean;
  idEstadoDepto?: number | null;
  estadoDepto?: { id: number; nombre: string } | null;
  cuadrillas?: { id: number; nombre: string }[] | null;
  tarifa?: { id: number; nombre: string } | null;
  estado?: {
    id: number;
    nombre: string;
  } | null;
  imagenes?: { id: number; url: string; createdAt?: string | Date | null }[] | null;
}

interface CatalogoCuadrilla {
  id: number;
  nombre: string;
}

export default function MapaGeneralZarate({ refreshKey = 0 }: { refreshKey?: number }) {
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const userMarkersMap = useRef<Map<number, any>>(new Map());
  const lastFittedRutaRef = useRef<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioGeo[]>([]);
  const usuariosRef = useRef<UsuarioGeo[]>(usuarios);
  usuariosRef.current = usuarios;

  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [buscandoRemoto, setBuscandoRemoto] = useState(false);
  const [resultadosRemotos, setResultadosRemotos] = useState<UsuarioGeo[]>([]);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const usuarioPendienteEnfoqueRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Búsqueda global de usuarios (por nombre, nroUsuario, domicilio o medidor en todas las rutas)
  useEffect(() => {
    const term = searchFilter.trim();
    if (term.length < 2) {
      setResultadosRemotos([]);
      setBuscandoRemoto(false);
      return;
    }

    setBuscandoRemoto(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/usuariosapi?search=${encodeURIComponent(term)}`);
        if (res.ok) {
          const data: UsuarioGeo[] = await res.json();
          setResultadosRemotos(data);
        }
      } catch (err) {
        console.error("Error en búsqueda global de usuarios:", err);
      } finally {
        setBuscandoRemoto(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchFilter]);

  // Estado del Filtro Obligatorio de Ruta
  const [rutaEscrita, setRutaEscrita] = useState<string>("");
  const [rutaActiva, setRutaActiva] = useState<string>("");
  const [rutaError, setRutaError] = useState<string | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState<boolean>(false);


  // Modal para ver los usuarios de la ruta activa que no tienen coordenadas
  const [showModalSinGeo, setShowModalSinGeo] = useState<boolean>(false);

  // Estados para mover punto geolocalizado en el mapa (individual o edificio completo)
  interface EdificioMoviendoData {
    buildingKey: string;
    nombre: string;
    usuarios: UsuarioGeo[];
    latOrig: number;
    lngOrig: number;
  }
  const [usuarioMoviendo, setUsuarioMoviendo] = useState<UsuarioGeo | null>(null);
  const [edificioMoviendo, setEdificioMoviendo] = useState<EdificioMoviendoData | null>(null);
  const mapaEdificiosRef = useRef<Map<string, any>>(new Map());
  const [coordsEdicion, setCoordsEdicion] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [guardandoPunto, setGuardandoPunto] = useState<boolean>(false);
  const movingMarkerRef = useRef<any>(null);
  const mapClickHandlerRef = useRef<any>(null);

  // Estados para combinar puntos sueltos con edificios o departamentos
  const [usuarioCombinando, setUsuarioCombinando] = useState<UsuarioGeo | null>(null);
  const usuarioCombinandoRef = useRef<UsuarioGeo | null>(null);
  usuarioCombinandoRef.current = usuarioCombinando;

  const [destinoCombinacion, setDestinoCombinacion] = useState<{
    lat: number;
    lng: number;
    domicilio: string;
    usuarios?: UsuarioGeo[];
    esEdificio?: boolean;
  } | null>(null);
  const destinoCombinacionRef = useRef<any>(null);
  destinoCombinacionRef.current = destinoCombinacion;

  const [pisoDeptoInput, setPisoDeptoInput] = useState<string>("");
  const [guardandoCombinacion, setGuardandoCombinacion] = useState<boolean>(false);

  // Estados para separar usuarios de un edificio
  const [usuarioSeparando, setUsuarioSeparando] = useState<UsuarioGeo | null>(null);
  const [separandoEdificio, setSeparandoEdificio] = useState<boolean>(false);

  // Estado de Pantalla Completa y Exportación de Mapa
  const [esPantallaCompleta, setEsPantallaCompleta] = useState<boolean>(false);
  const [exportandoMapa, setExportandoMapa] = useState<boolean>(false);
  const [fotoFullscreen, setFotoFullscreen] = useState<string | null>(null);
  const [menuExportarAbierto, setMenuExportarAbierto] = useState<boolean>(false);
  const [menuExportarAlineacion, setMenuExportarAlineacion] = useState<"left" | "right">("left");
  const menuExportarRef = useRef<HTMLDivElement | null>(null);

  const toggleMenuExportar = () => {
    if (!menuExportarAbierto && menuExportarRef.current) {
      const rect = menuExportarRef.current.getBoundingClientRect();
      // Si el botón está pegado o cerca del borde izquierdo, alinear a la izquierda (left: 0)
      // para que el menú de 330px se despliegue a la derecha y no quede tapado por la izquierda
      if (rect.left < 340) {
        setMenuExportarAlineacion("left");
      } else {
        setMenuExportarAlineacion("right");
      }
    }
    setMenuExportarAbierto((prev) => !prev);
  };

  // Cerrar menú de exportación al hacer clic fuera
  useEffect(() => {
    const handleClicFueraExportar = (e: MouseEvent) => {
      if (menuExportarRef.current && !menuExportarRef.current.contains(e.target as Node)) {
        setMenuExportarAbierto(false);
      }
    };
    if (menuExportarAbierto) {
      document.addEventListener("mousedown", handleClicFueraExportar);
    }
    return () => {
      document.removeEventListener("mousedown", handleClicFueraExportar);
    };
  }, [menuExportarAbierto]);

  // Alternar pantalla completa nativa y CSS
  const togglePantallaCompleta = async () => {
    try {
      if (!document.fullscreenElement) {
        if (cardContainerRef.current?.requestFullscreen) {
          await cardContainerRef.current.requestFullscreen();
        }
        setEsPantallaCompleta(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setEsPantallaCompleta(false);
      }
    } catch {
      // Fallback si la API de fullscreen está restringida
      setEsPantallaCompleta((prev) => !prev);
    }
  };

  // Listener para sincronizar estado si el usuario presiona 'Esc'
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setEsPantallaCompleta(isFs);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  }, [esPantallaCompleta]);

  // Filtros por Estado (Multi-selección) y control del panel Ayuda Memoria
  const [filtrosEstadoKeys, setFiltrosEstadoKeys] = useState<string[]>([]);
  const [filtroTipoInmueble, setFiltroTipoInmueble] = useState<"todos" | "departamentos" | "independientes">("todos");
  const [ayudaMemoriaAbierto, setAyudaMemoriaAbierto] = useState<boolean>(true);

  // Alternar filtro individual (permite múltiples filtros simultáneos)
  const toggleFiltroEstado = (key: string) => {
    setFiltrosEstadoKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const limpiarTodosLosFiltros = () => {
    setFiltrosEstadoKeys([]);
    setFiltroTipoInmueble("todos");
  };

  // Modos de Planificación: "automatico" (por cercanía) o "manual" (uno a uno)
  const [modoPlanificador, setModoPlanificador] = useState<"automatico" | "manual">("automatico");
  const [paradasManuales, setParadasManuales] = useState<UsuarioGeo[]>([]);
  const [clickDirectoManual, setClickDirectoManual] = useState<boolean>(true);
  const [busquedaManualInput, setBusquedaManualInput] = useState<string>("");

  const modoPlanificadorRef = useRef(modoPlanificador);
  modoPlanificadorRef.current = modoPlanificador;

  const clickDirectoManualRef = useRef(clickDirectoManual);
  clickDirectoManualRef.current = clickDirectoManual;

  const paradasManualesRef = useRef(paradasManuales);
  paradasManualesRef.current = paradasManuales;

  const actualizarRutaConCallesRef = useRef<any>(null);

  // Estados del Planificador de Cortes
  const [usuarioInicioId, setUsuarioInicioId] = useState<number | null>(null);
  const [cantidadCortes, setCantidadCortes] = useState<number>(5);
  const [resultadoRuta, setResultadoRuta] = useState<ResultadoRuta | null>(null);

  // Estados de Asignación Masiva de Cuadrillas a la Ruta
  const [cuadrillasDisponibles, setCuadrillasDisponibles] = useState<CatalogoCuadrilla[]>([]);
  const [cuadrillasSeleccionadasRuta, setCuadrillasSeleccionadasRuta] = useState<number[]>([]);
  const [asignandoCuadrillas, setAsignandoCuadrillas] = useState(false);

  // Opciones de Creación de Ruta (ocultas por defecto hasta pulsar 'Crear ruta')
  const [mostrarPlanificadorRuta, setMostrarPlanificadorRuta] = useState(false);

  // Estado que confirma que la instancia de Leaflet está montada y lista en el DOM
  const [mapReady, setMapReady] = useState(false);

  // Modificar el texto escrito en el input de ruta sin ejecutar la búsqueda automáticamente
  const handleInputRuta = (valor: string) => {
    setRutaEscrita(valor);
    if (rutaError) {
      setRutaError(null);
    }
  };

  // Ejecutar la búsqueda y validación de la ruta al presionar el botón o la tecla Enter
  const handleBuscarRuta = (rutaDirecta?: string) => {
    const valor = (rutaDirecta !== undefined ? rutaDirecta : rutaEscrita).trim();

    if (!valor) {
      setRutaError("Por favor ingresá un número de ruta para buscar.");
      return;
    }

    if (!esRutaValida(valor)) {
      setRutaActiva("");
      setRutaError(`La ruta "${valor}" no existe. Las rutas permitidas son del 1 al 78, del 201 al 212, y 301, 302, 303.`);
      setUsuarios([]);
      if (markersLayerRef.current) markersLayerRef.current.clearLayers();
      if (routeLayerRef.current) routeLayerRef.current.clearLayers();
      setResultadoRuta(null);
      return;
    }

    const num = parseInt(valor, 10);
    const rutaNorm = String(num);
    setRutaError(null);
    setRutaEscrita(rutaNorm);
    setRutaActiva(rutaNorm);
  };

  // Limpiar y resetear el filtro de ruta operativa activa
  const handleResetFiltroRuta = () => {
    lastFittedRutaRef.current = null;
    setRutaEscrita("");
    setRutaActiva("");
    setRutaError(null);
    setUsuarios([]);
    if (markersLayerRef.current) markersLayerRef.current.clearLayers();
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    setResultadoRuta(null);
  };

  // Cargar catálogo de cuadrillas al iniciar
  useEffect(() => {
    fetch("/api/cuadrillasapi")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCuadrillasDisponibles(data))
      .catch((err) => console.error("Error al cargar cuadrillas:", err));
  }, []);

  // Cargar usuarios de la ruta activa desde la API de forma ultrarrápida
  const fetchUsuariosRuta = async () => {
    if (!rutaActiva) {
      setUsuarios([]);
      setLoading(false);
      return;
    }

    setCargandoRuta(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/usuariosapi?ruta=${encodeURIComponent(rutaActiva)}`);
      if (res.ok) {
        const data: UsuarioGeo[] = await res.json();
        setUsuarios(data);
        if (data.length === 0) {
          setRutaError(`No se encontraron usuarios registrados en la ruta ${rutaActiva}.`);
        } else {
          const georref = data.filter(
            (u) => u.latitud !== null && u.longitud !== null && !isNaN(Number(u.latitud))
          );
          if (georref.length === 0) {
            toast.warning(`La ruta ${rutaActiva} tiene ${data.length} usuarios pero aún no tienen coordenadas en el mapa.`);
          } else {
            toast.success(`Ruta ${rutaActiva}: ${data.length} usuarios (${georref.length} en mapa)`);
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar ruta:", err);
    } finally {
      setCargandoRuta(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuariosRuta();
  }, [rutaActiva, refreshKey]);


  // Hook global para que los popups puedan fijar el inicio, agregar/quitar manual y mover orden
  useEffect(() => {
    (window as any).fijarUsuarioInicioCorte = (id: number) => {
      setUsuarioInicioId(id);
      setModoPlanificador("automatico");
      const user = usuarios.find((u) => u.id === id);
      if (user) {
        toast.info(`Usuario #${user.nroUsuario} fijado como punto de partida de cortes`);
      }
    };

    (window as any).toggleParadaManual = (id: number) => {
      setModoPlanificador("manual");
      const usuario = usuarios.find((u) => u.id === id);
      if (!usuario) return;

      const prev = paradasManualesRef.current;
      const existe = prev.some((p) => p.id === id);
      let nuevaLista: UsuarioGeo[] = [];

      if (existe) {
        nuevaLista = prev.filter((p) => p.id !== id);
        toast.info(`Usuario #${usuario.nroUsuario} quitado de la ruta manual`);
      } else {
        nuevaLista = [...prev, usuario];
        toast.success(`Parada #${nuevaLista.length}: Usuario #${usuario.nroUsuario} agregado`);
      }

      setParadasManuales(nuevaLista);

      if (nuevaLista.length > 0) {
        const res = construirRutaManual(nuevaLista);
        if (actualizarRutaConCallesRef.current) {
          actualizarRutaConCallesRef.current(res);
        }
      } else {
        setResultadoRuta(null);
        if (routeLayerRef.current) routeLayerRef.current.clearLayers();
      }
    };

    (window as any).moverParadaManual = (id: number, direccion: number) => {
      const prev = paradasManualesRef.current;
      const index = prev.findIndex((p) => p.id === id);
      if (index === -1) return;
      const nuevoIndex = index + direccion;
      if (nuevoIndex < 0 || nuevoIndex >= prev.length) return;
      const copia = [...prev];
      const item = copia.splice(index, 1)[0];
      copia.splice(nuevoIndex, 0, item);
      setParadasManuales(copia);
      const res = construirRutaManual(copia);
      if (actualizarRutaConCallesRef.current) {
        actualizarRutaConCallesRef.current(res);
      }
    };

    (window as any).iniciarMoverPunto = (id: number) => {
      iniciarMoverPunto(id);
    };

    (window as any).iniciarMoverEdificioCompleto = (key: string) => {
      iniciarMoverEdificioCompleto(key);
    };

    (window as any).filtrarUsuariosEdificio = (input: HTMLInputElement, listId: string) => {
      const query = (input.value || "").toLowerCase().trim();
      const list = document.getElementById(listId);
      if (!list) return;
      const items = list.querySelectorAll(".edificio-user-item");
      items.forEach((item: any) => {
        const text = (item.getAttribute("data-search") || item.textContent || "").toLowerCase();
        if (!query || text.includes(query)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    };

    (window as any).iniciarCombinarUsuario = (id: number) => {
      const u = usuarios.find((user) => user.id === id);
      if (!u) return;
      if (mapInstanceRef.current) mapInstanceRef.current.closePopup();
      setUsuarioCombinando(u);
      toast.info(`Modo combinar activo: haz clic en el edificio o departamento donde deseas incluir a #${u.nroUsuario}`, { autoClose: 5000 });
    };

    (window as any).iniciarUnirPuntosAEdificio = (lat: number, lng: number, encodedDom: string) => {
      const dom = decodeURIComponent(encodedDom);
      if (mapInstanceRef.current) mapInstanceRef.current.closePopup();
      setDestinoCombinacion({
        lat,
        lng,
        domicilio: dom,
        usuarios: [],
        esEdificio: true,
      });
      toast.info(`Selecciona en el mapa el punto suelto que deseas incorporar a "${dom}"`, { autoClose: 5000 });
    };

    (window as any).iniciarSepararUsuarioDeEdificio = (id: number) => {
      const u = usuarios.find((user) => user.id === id);
      if (!u) return;
      if (mapInstanceRef.current) mapInstanceRef.current.closePopup();
      setUsuarioSeparando(u);
    };

    (window as any).abrirFotoFullscreenEnMapa = (url: string) => {
      setFotoFullscreen(decodeURIComponent(url));
    };

    return () => {
      delete (window as any).fijarUsuarioInicioCorte;
      delete (window as any).toggleParadaManual;
      delete (window as any).moverParadaManual;
      delete (window as any).iniciarMoverPunto;
      delete (window as any).iniciarMoverEdificioCompleto;
      delete (window as any).filtrarUsuariosEdificio;
      delete (window as any).iniciarCombinarUsuario;
      delete (window as any).iniciarUnirPuntosAEdificio;
      delete (window as any).iniciarSepararUsuarioDeEdificio;
      delete (window as any).abrirFotoFullscreenEnMapa;
    };
  }, [usuarios]);

  // Funciones para Mover Punto Geolocalizado (Individual)
  const iniciarMoverPunto = (id: number) => {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario || usuario.latitud === null || usuario.longitud === null) {
      toast.warning("El usuario seleccionado no cuenta con coordenadas válidas para mover.");
      return;
    }

    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Cerrar popups y paneles abiertos
    map.closePopup();
    setMostrarPlanificadorRuta(false);
    setShowModalSinGeo(false);

    const latOrig = Number(usuario.latitud);
    const lngOrig = Number(usuario.longitud);

    setEdificioMoviendo(null);
    setUsuarioMoviendo(usuario);
    setCoordsEdicion({ lat: latOrig, lng: lngOrig });

    // Ocultar inmediatamente todos los demás marcadores y capas para despejar completamente el mapa
    if (markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
      map.removeLayer(markersLayerRef.current);
    }
    if (routeLayerRef.current && map.hasLayer(routeLayerRef.current)) {
      map.removeLayer(routeLayerRef.current);
    }

    // Limpiar marcador temporal anterior si existiera
    if (movingMarkerRef.current) {
      map.removeLayer(movingMarkerRef.current);
      movingMarkerRef.current = null;
    }
    if (mapClickHandlerRef.current) {
      map.off("click", mapClickHandlerRef.current);
      mapClickHandlerRef.current = null;
    }

    // Centrar suavemente en el punto
    map.panTo([latOrig, lngOrig]);

    // Crear icono distintivo de arrastre
    const movingIconHtml = `
      <div class="custom-moving-pin">
        <div class="custom-moving-badge">
          <span class="custom-moving-dot"></span>
          <span>📍 MOVER #${usuario.nroUsuario}</span>
        </div>
        <div class="custom-moving-tip"></div>
      </div>
    `;

    const movingIcon = L.divIcon({
      className: "custom-moving-marker-wrapper",
      html: movingIconHtml,
      iconSize: [140, 42],
      iconAnchor: [70, 40],
    });

    const movingMarker = L.marker([latOrig, lngOrig], {
      draggable: true,
      icon: movingIcon,
      zIndexOffset: 4000,
    }).addTo(map);

    // Eventos de arrastre
    movingMarker.on("drag", (e: any) => {
      const pos = e.target.getLatLng();
      setCoordsEdicion({
        lat: Number(pos.lat.toFixed(7)),
        lng: Number(pos.lng.toFixed(7)),
      });
    });

    movingMarker.on("dragend", (e: any) => {
      const pos = e.target.getLatLng();
      setCoordsEdicion({
        lat: Number(pos.lat.toFixed(7)),
        lng: Number(pos.lng.toFixed(7)),
      });
      toast.info(`📍 Posición seleccionada: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
    });

    movingMarkerRef.current = movingMarker;

    // Evento de clic en cualquier lugar del mapa para posicionarlo directamente
    const onMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      const formattedLat = Number(lat.toFixed(7));
      const formattedLng = Number(lng.toFixed(7));
      movingMarker.setLatLng([formattedLat, formattedLng]);
      setCoordsEdicion({ lat: formattedLat, lng: formattedLng });
      toast.info(`📍 Posición fijada con clic: ${formattedLat.toFixed(6)}, ${formattedLng.toFixed(6)}`);
    };

    map.on("click", onMapClick);
    mapClickHandlerRef.current = onMapClick;

    toast.info(`📍 Modo mover punto activo para #${usuario.nroUsuario}. Arrastrá el marcador naranja o hacé clic en el mapa.`);
  };

  // Función para Mover Edificio Completo (Actualiza todos los departamentos a la vez)
  const iniciarMoverEdificioCompleto = (key: string) => {
    const grupo = mapaEdificiosRef.current.get(key);
    if (!grupo || !grupo.usuarios || grupo.usuarios.length === 0) {
      toast.warning("No se encontraron los datos del edificio para mover.");
      return;
    }

    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Cerrar popups y paneles abiertos
    map.closePopup();
    setMostrarPlanificadorRuta(false);
    setShowModalSinGeo(false);

    const latOrig = Number(grupo.lat);
    const lngOrig = Number(grupo.lng);

    setUsuarioMoviendo(null);
    setEdificioMoviendo({
      buildingKey: key,
      nombre: grupo.domicilioEdificio,
      usuarios: grupo.usuarios,
      latOrig,
      lngOrig,
    });
    setCoordsEdicion({ lat: latOrig, lng: lngOrig });

    // Ocultar inmediatamente todos los demás marcadores y capas para despejar completamente el mapa
    if (markersLayerRef.current && map.hasLayer(markersLayerRef.current)) {
      map.removeLayer(markersLayerRef.current);
    }
    if (routeLayerRef.current && map.hasLayer(routeLayerRef.current)) {
      map.removeLayer(routeLayerRef.current);
    }

    // Limpiar marcador temporal anterior si existiera
    if (movingMarkerRef.current) {
      map.removeLayer(movingMarkerRef.current);
      movingMarkerRef.current = null;
    }
    if (mapClickHandlerRef.current) {
      map.off("click", mapClickHandlerRef.current);
      mapClickHandlerRef.current = null;
    }

    // Centrar suavemente en el punto
    map.panTo([latOrig, lngOrig]);

    // Crear icono distintivo de arrastre de EDIFICIO
    const movingIconHtml = `
      <div class="custom-moving-pin edificio">
        <div class="custom-moving-badge edificio">
          <span class="custom-moving-dot"></span>
          <span>🏢 MOVER EDIFICIO: ${grupo.domicilioEdificio} (${grupo.usuarios.length} deptos)</span>
        </div>
        <div class="custom-moving-tip edificio"></div>
      </div>
    `;

    const movingIcon = L.divIcon({
      className: "custom-moving-marker-wrapper edificio",
      html: movingIconHtml,
      iconSize: [260, 42],
      iconAnchor: [130, 40],
    });

    const movingMarker = L.marker([latOrig, lngOrig], {
      draggable: true,
      icon: movingIcon,
      zIndexOffset: 4500,
    }).addTo(map);

    movingMarker.on("drag", (e: any) => {
      const pos = e.target.getLatLng();
      setCoordsEdicion({
        lat: Number(pos.lat.toFixed(7)),
        lng: Number(pos.lng.toFixed(7)),
      });
    });

    movingMarker.on("dragend", (e: any) => {
      const pos = e.target.getLatLng();
      setCoordsEdicion({
        lat: Number(pos.lat.toFixed(7)),
        lng: Number(pos.lng.toFixed(7)),
      });
      toast.info(`📍 Posición de edificio: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
    });

    movingMarkerRef.current = movingMarker;

    const onMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      const formattedLat = Number(lat.toFixed(7));
      const formattedLng = Number(lng.toFixed(7));
      movingMarker.setLatLng([formattedLat, formattedLng]);
      setCoordsEdicion({ lat: formattedLat, lng: formattedLng });
      toast.info(`📍 Posición de edificio fijada: ${formattedLat.toFixed(6)}, ${formattedLng.toFixed(6)}`);
    };

    map.on("click", onMapClick);
    mapClickHandlerRef.current = onMapClick;

    toast.info(`🏢 Modo mover edificio activo para "${grupo.domicilioEdificio}". Arrastrá el marcador o hacé clic en el mapa.`);
  };

  const cancelarMoverPunto = () => {
    const map = mapInstanceRef.current;
    if (map) {
      if (movingMarkerRef.current) {
        map.removeLayer(movingMarkerRef.current);
        movingMarkerRef.current = null;
      }
      if (mapClickHandlerRef.current) {
        map.off("click", mapClickHandlerRef.current);
        mapClickHandlerRef.current = null;
      }
      // Restaurar las capas de marcadores y rutas en el mapa
      if (markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
        map.addLayer(markersLayerRef.current);
      }
      if (routeLayerRef.current && !map.hasLayer(routeLayerRef.current)) {
        map.addLayer(routeLayerRef.current);
      }
    }
    setUsuarioMoviendo(null);
    setEdificioMoviendo(null);
    toast.info("Modificación de punto cancelada. Se restauraron los marcadores.");
  };

  const revertirCoordsOriginales = () => {
    if (edificioMoviendo) {
      const latOrig = Number(edificioMoviendo.latOrig);
      const lngOrig = Number(edificioMoviendo.lngOrig);
      setCoordsEdicion({ lat: latOrig, lng: lngOrig });
      if (movingMarkerRef.current) {
        movingMarkerRef.current.setLatLng([latOrig, lngOrig]);
      }
      mapInstanceRef.current?.panTo([latOrig, lngOrig]);
      toast.info("Coordenadas del edificio revertidas a su valor original.");
      return;
    }
    if (!usuarioMoviendo || usuarioMoviendo.latitud === null || usuarioMoviendo.longitud === null) return;
    const latOrig = Number(usuarioMoviendo.latitud);
    const lngOrig = Number(usuarioMoviendo.longitud);

    setCoordsEdicion({ lat: latOrig, lng: lngOrig });
    if (movingMarkerRef.current) {
      movingMarkerRef.current.setLatLng([latOrig, lngOrig]);
    }
    mapInstanceRef.current?.panTo([latOrig, lngOrig]);
    toast.info("Coordenadas revertidas a su valor original.");
  };

  const handleCoordInputChange = (newLat: number, newLng: number) => {
    setCoordsEdicion({ lat: newLat, lng: newLng });
    if (!isNaN(newLat) && !isNaN(newLng) && movingMarkerRef.current) {
      movingMarkerRef.current.setLatLng([newLat, newLng]);
      mapInstanceRef.current?.panTo([newLat, newLng]);
    }
  };

  const guardarNuevoPunto = async () => {
    if (!usuarioMoviendo && !edificioMoviendo) return;
    if (isNaN(coordsEdicion.lat) || isNaN(coordsEdicion.lng)) {
      toast.error("Las coordenadas ingresadas no son válidas.");
      return;
    }

    try {
      setGuardandoPunto(true);
      const newLat = Number(coordsEdicion.lat.toFixed(7));
      const newLng = Number(coordsEdicion.lng.toFixed(7));
      const newMaps = `https://www.google.com/maps?q=${newLat.toFixed(6)},${newLng.toFixed(6)}`;

      // Capturar la posición actual exacta de la cámara y zoom antes de guardar
      const map = mapInstanceRef.current;
      const centroPrevio = map ? map.getCenter() : null;
      const zoomPrevio = map ? map.getZoom() : null;

      if (edificioMoviendo) {
        const userIds = edificioMoviendo.usuarios.map((u) => u.id);
        const res = await fetch("/api/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds,
            latitud: newLat,
            longitud: newLng,
            maps: newMaps,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "No se pudo actualizar el edificio en el servidor");
        }

        const userIdsSet = new Set(userIds);

        // Actualizar en el estado de usuarios
        setUsuarios((prev) =>
          prev.map((u) =>
            userIdsSet.has(u.id)
              ? { ...u, latitud: newLat, longitud: newLng, maps: newMaps }
              : u
          )
        );

        // Si alguno está en las paradas manuales, actualizarlo también
        setParadasManuales((prev) =>
          prev.map((p) =>
            userIdsSet.has(p.id)
              ? { ...p, latitud: newLat, longitud: newLng, maps: newMaps }
              : p
          )
        );

        // Limpiar el marcador temporal y listener
        if (map) {
          if (movingMarkerRef.current) {
            map.removeLayer(movingMarkerRef.current);
            movingMarkerRef.current = null;
          }
          if (mapClickHandlerRef.current) {
            map.off("click", mapClickHandlerRef.current);
            mapClickHandlerRef.current = null;
          }

          if (markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
            map.addLayer(markersLayerRef.current);
          }
          if (routeLayerRef.current && !map.hasLayer(routeLayerRef.current)) {
            map.addLayer(routeLayerRef.current);
          }

          if (centroPrevio && zoomPrevio !== null) {
            requestAnimationFrame(() => {
              map.setView(centroPrevio, zoomPrevio, { animate: false });
            });
          }
        }

        const nombreEdif = edificioMoviendo.nombre;
        const cantDeptos = edificioMoviendo.usuarios.length;
        setEdificioMoviendo(null);
        toast.success(`🏢 ¡Edificio "${nombreEdif}" (${cantDeptos} departamentos) movido correctamente a Lat ${newLat}, Lon ${newLng}!`);
      } else if (usuarioMoviendo) {
        const res = await fetch(`/api/users?id=${usuarioMoviendo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitud: newLat,
            longitud: newLng,
            maps: newMaps,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "No se pudo actualizar el punto en el servidor");
        }

        // Actualizar en el estado de usuarios
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === usuarioMoviendo.id
              ? { ...u, latitud: newLat, longitud: newLng, maps: newMaps }
              : u
          )
        );

        // Si está en las paradas manuales, actualizarlo también
        setParadasManuales((prev) =>
          prev.map((p) =>
            p.id === usuarioMoviendo.id
              ? { ...p, latitud: newLat, longitud: newLng, maps: newMaps }
              : p
          )
        );

        // Limpiar el marcador temporal y listener
        if (map) {
          if (movingMarkerRef.current) {
            map.removeLayer(movingMarkerRef.current);
            movingMarkerRef.current = null;
          }
          if (mapClickHandlerRef.current) {
            map.off("click", mapClickHandlerRef.current);
            mapClickHandlerRef.current = null;
          }

          if (markersLayerRef.current && !map.hasLayer(markersLayerRef.current)) {
            map.addLayer(markersLayerRef.current);
          }
          if (routeLayerRef.current && !map.hasLayer(routeLayerRef.current)) {
            map.addLayer(routeLayerRef.current);
          }

          if (centroPrevio && zoomPrevio !== null) {
            requestAnimationFrame(() => {
              map.setView(centroPrevio, zoomPrevio, { animate: false });
            });
          }
        }

        const nroUser = usuarioMoviendo.nroUsuario;
        setUsuarioMoviendo(null);
        toast.success(`✅ Ubicación de #${nroUser} guardada correctamente: Lat ${newLat}, Lon ${newLng}`);
      }
    } catch (error: any) {
      console.error("Error al guardar punto:", error);
      toast.error(error.message || "Error al guardar la nueva ubicación.");
    } finally {
      setGuardandoPunto(false);
    }
  };

  // Función para confirmar la combinación e inclusión de un usuario en un edificio
  const handleConfirmarCombinacion = async () => {
    if (!usuarioCombinando || !destinoCombinacion) return;

    try {
      setGuardandoCombinacion(true);
      const newLat = Number(destinoCombinacion.lat.toFixed(7));
      const newLng = Number(destinoCombinacion.lng.toFixed(7));
      const newMaps = `https://www.google.com/maps?q=${newLat.toFixed(6)},${newLng.toFixed(6)}`;

      let nuevoDomicilio = usuarioCombinando.domicilio || destinoCombinacion.domicilio;
      if (pisoDeptoInput.trim()) {
        const base = destinoCombinacion.domicilio || usuarioCombinando.domicilio || "";
        nuevoDomicilio = `${base} ${pisoDeptoInput.trim()}`.trim();
      } else if (destinoCombinacion.domicilio && !usuarioCombinando.domicilio) {
        nuevoDomicilio = destinoCombinacion.domicilio;
      }

      const res = await fetch(`/api/users?id=${usuarioCombinando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitud: newLat,
          longitud: newLng,
          maps: newMaps,
          esDepartamento: true,
          domicilio: nuevoDomicilio,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo actualizar el usuario en el servidor");
      }

      // Actualizar estado local de usuarios
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuarioCombinando.id
            ? {
              ...u,
              latitud: newLat,
              longitud: newLng,
              maps: newMaps,
              esDepartamento: true,
              domicilio: nuevoDomicilio,
            }
            : u
        )
      );

      // Si estaba en la lista de paradas manuales, actualizarlo también
      setParadasManuales((prev) =>
        prev.map((p) =>
          p.id === usuarioCombinando.id
            ? {
              ...p,
              latitud: newLat,
              longitud: newLng,
              maps: newMaps,
              esDepartamento: true,
              domicilio: nuevoDomicilio,
            }
            : p
        )
      );

      toast.success(`✅ ¡Usuario #${usuarioCombinando.nroUsuario} incorporado con éxito al edificio!`);

      const targetUserId = usuarioCombinando.id;
      setUsuarioCombinando(null);
      setDestinoCombinacion(null);
      setPisoDeptoInput("");

      // Abrir el edificio en el mapa y enfocar al usuario incorporado
      setTimeout(() => {
        enfocarMarcador(targetUserId);
      }, 500);
    } catch (error: any) {
      console.error("Error al combinar usuario con edificio:", error);
      toast.error(error.message || "Error al combinar con el edificio");
    } finally {
      setGuardandoCombinacion(false);
    }
  };

  // Función para desvincular/separar a un usuario de un edificio
  const handleConfirmarSeparacion = async (moverEnMapa: boolean) => {
    if (!usuarioSeparando) return;

    try {
      setSeparandoEdificio(true);
      const res = await fetch(`/api/users?id=${usuarioSeparando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          esDepartamento: false,
          idEstadoDepto: null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo separar el usuario del edificio");
      }

      // Actualizar estado local
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === usuarioSeparando.id
            ? {
              ...u,
              esDepartamento: false,
              idEstadoDepto: null,
              estadoDepto: null,
            }
            : u
        )
      );

      setParadasManuales((prev) =>
        prev.map((p) =>
          p.id === usuarioSeparando.id
            ? {
              ...p,
              esDepartamento: false,
              idEstadoDepto: null,
              estadoDepto: null,
            }
            : p
        )
      );

      const targetUser = usuarioSeparando;
      setUsuarioSeparando(null);

      toast.success(`✂️ ¡Usuario #${targetUser.nroUsuario} separado del edificio correctamente!`);

      if (moverEnMapa) {
        setTimeout(() => {
          iniciarMoverPunto(targetUser.id);
        }, 200);
      } else {
        setTimeout(() => {
          enfocarMarcador(targetUser.id);
        }, 300);
      }
    } catch (error: any) {
      console.error("Error al separar usuario del edificio:", error);
      toast.error(error.message || "Error al separar usuario del edificio");
    } finally {
      setSeparandoEdificio(false);
    }
  };

  // Ocultar todos los demás marcadores y capas del mapa mientras se mueve un punto para máxima precisión visual
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map) return;

    if (usuarioMoviendo) {
      if (markersLayer && map.hasLayer(markersLayer)) {
        map.removeLayer(markersLayer);
      }
      if (routeLayer && map.hasLayer(routeLayer)) {
        map.removeLayer(routeLayer);
      }
    } else {
      if (markersLayer && !map.hasLayer(markersLayer)) {
        map.addLayer(markersLayer);
      }
      if (routeLayer && !map.hasLayer(routeLayer)) {
        map.addLayer(routeLayer);
      }
    }
  }, [usuarioMoviendo]);

  // Permitir cancelar el modo mover punto con la tecla Escape
  useEffect(() => {
    if (!usuarioMoviendo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelarMoverPunto();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [usuarioMoviendo]);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      LRef.current = L;

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: ZARATE_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: true,
        preferCanvas: true,
        maxZoom: 20,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxNativeZoom: 19,
        maxZoom: 20,
        crossOrigin: true,
      }).addTo(map);

      // Agrupamiento inteligente de marcadores con chunkedLoading para soportar 12.000+ puntos a 60 FPS
      const markersLayer = (L as any).markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 50,
        chunkDelay: 25,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 18, // En zoom máximo (18 y superior) se desactivan los clusters y se muestran todos los marcadores individuales exactos
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster: any) => {
          const markers = cluster.getAllChildMarkers();
          const count = cluster.getChildCount();

          // Analizar el estado de los marcadores contenidos en este cluster
          const conteos: Record<string, { count: number; config: any }> = {};
          for (const m of markers) {
            const cfg = (m as any).options?.userConfig;
            if (cfg) {
              if (!conteos[cfg.key]) {
                conteos[cfg.key] = { count: 0, config: cfg };
              }
              conteos[cfg.key].count++;
            }
          }

          // Tomar el estado dominante o el del filtro activo
          let dominante: any = null;
          let maxCount = 0;
          for (const k in conteos) {
            if (conteos[k].count > maxCount) {
              maxCount = conteos[k].count;
              dominante = conteos[k].config;
            }
          }

          const bg = dominante?.bg || "#ef4444";
          const text = dominante?.text || "#ffffff";
          const border = dominante?.border || "#b91c1c";
          const emoji = dominante?.emoji || "";

          // Tamaño y tipografía adaptativa
          const size = count < 10 ? 36 : count < 100 ? 42 : 48;
          const fontSize = count < 10 ? 12 : count < 100 ? 13 : 14;

          return L.divIcon({
            html: `
              <div class="custom-cluster-globito" style="
                width: ${size}px;
                height: ${size}px;
                background: ${bg};
                color: ${text};
                border: 2.5px solid #ffffff;
                box-shadow: 0 4px 12px rgba(0,0,0,0.35), 0 0 0 3px ${bg}55;
                font-size: ${fontSize}px;
              ">
                ${emoji ? `<span class="globito-emoji">${emoji}</span>` : ""}
                <span class="globito-number">${count}</span>
              </div>
            `,
            className: "cluster-globito-wrapper",
            iconSize: L.point(size, size),
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
      map.addLayer(markersLayer);

      const routeLayer = L.layerGroup().addTo(map);

      markersLayerRef.current = markersLayer;
      routeLayerRef.current = routeLayer;
      mapInstanceRef.current = map;
      setMapReady(true);

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener("resize", handleResize);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 300);
    }

    initMap();

    return () => {
      isMounted = false;
      setMapReady(false);
      window.removeEventListener("resize", () => { });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

  const usuariosGeoreferenciados = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.latitud !== null &&
        u.longitud !== null &&
        !isNaN(Number(u.latitud)) &&
        !isNaN(Number(u.longitud))
    );
  }, [usuarios]);

  // Usuarios de la ruta que NO poseen coordenadas geográficas / no fueron encontrados en Maps
  const usuariosSinGeo = useMemo(() => {
    return usuarios.filter((u) => !u.latitud || !u.longitud || isNaN(Number(u.latitud)));
  }, [usuarios]);

  const esUsuarioDepartamento = (u: UsuarioGeo): boolean => {
    return tieneCheckEdificio(u);
  };

  const conteoDepartamentos = useMemo(() => {
    return usuariosGeoreferenciados.filter((u) => tieneCheckEdificio(u)).length;
  }, [usuariosGeoreferenciados]);

  const conteoIndependientes = useMemo(() => {
    return usuariosGeoreferenciados.filter((u) => !tieneCheckEdificio(u)).length;
  }, [usuariosGeoreferenciados]);

  // Usuarios filtrados por tipo de inmueble (departamentos vs independientes) y por estados
  const usuariosAMostrar = useMemo(() => {
    return usuariosGeoreferenciados.filter((u) => {
      if (filtroTipoInmueble === "departamentos" && !tieneCheckEdificio(u)) {
        return false;
      }
      if (filtroTipoInmueble === "independientes" && tieneCheckEdificio(u)) {
        return false;
      }
      if (filtrosEstadoKeys.length === 0) return true;
      const c = obtenerConfigEstadoPorUsuario(u.estado);
      return filtrosEstadoKeys.includes(c.key);
    });
  }, [usuariosGeoreferenciados, filtrosEstadoKeys, filtroTipoInmueble]);

  // Conteo de usuarios por cada estado en la ruta seleccionada (respetando filtro de tipo de inmueble)
  const conteoPorEstado = useMemo(() => {
    const mapaConteos: Record<string, number> = {};
    const base = usuariosGeoreferenciados.filter((u) => {
      if (filtroTipoInmueble === "departamentos") return tieneCheckEdificio(u);
      if (filtroTipoInmueble === "independientes") return !tieneCheckEdificio(u);
      return true;
    });

    base.forEach((u) => {
      const config = obtenerConfigEstadoPorUsuario(u.estado);
      mapaConteos[config.key] = (mapaConteos[config.key] || 0) + 1;
    });
    return mapaConteos;
  }, [usuariosGeoreferenciados, filtroTipoInmueble]);

  // Lista de configuraciones de los estados actualmente filtrados
  const configsFiltrosActivos = useMemo(() => {
    return ESTADOS_MAPA_CONFIG.filter((e) => filtrosEstadoKeys.includes(e.key));
  }, [filtrosEstadoKeys]);

  // Auto-ajustar cámara del mapa a los puntos de la ruta cargada
  useEffect(() => {
    if (!mapInstanceRef.current || !rutaActiva || !LRef.current) {
      lastFittedRutaRef.current = null;
      return;
    }

    // Si ya ajustamos la vista para esta ruta activa, no volvemos a resetear zoom/cámara
    if (lastFittedRutaRef.current === rutaActiva) {
      return;
    }

    const puntos = usuariosAMostrar
      .filter((u) => u.latitud && u.longitud && !isNaN(Number(u.latitud)))
      .map((u) => [Number(u.latitud), Number(u.longitud)] as [number, number]);

    if (puntos.length > 0) {
      try {
        const bounds = LRef.current.latLngBounds(puntos);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        lastFittedRutaRef.current = rutaActiva;
      } catch (e) { }
    }
  }, [rutaActiva, usuariosAMostrar]);

  // Pintar los marcadores de los usuarios cuando cambian los datos, la ruta o el filtro de estado
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !LRef.current) return;

    const L = LRef.current;
    markersLayerRef.current.clearLayers();
    userMarkersMap.current.clear();

    // Obtener los IDs de los usuarios de la ruta activa para no duplicar pines
    const idsEnRuta = new Set(
      resultadoRuta ? resultadoRuta.paradas.map((p) => p.usuario.id) : []
    );

    // Mapeo de paradas en ruta para mostrar orden (#1, #2) en el popup del edificio
    const paradasPorUsuarioId = new Map<number, number>();
    if (resultadoRuta) {
      resultadoRuta.paradas.forEach((p) => {
        paradasPorUsuarioId.set(p.usuario.id, p.orden);
      });
    }

    const boundsPoints: [number, number][] = [];
    const markersParaAgregar: any[] = [];

    interface GrupoMarcador {
      lat: number;
      lng: number;
      usuarios: UsuarioGeo[];
      esEdificio: boolean;
      domicilioEdificio: string;
      buildingKey?: string;
    }

    // Agrupación de edificios: ÚNICAMENTE para usuarios que cumplan AMBAS condiciones:
    // 1. Tienen activo el check de edificio / departamento (tieneCheckEdificio).
    // 2. Tienen la misma dirección base normalizada (ej: "Mitre 302 PB" y "Mitre 302 Bis 2" -> "mitre 302").
    // Los puntos que están juntos pero no cumplen ambas condiciones NO se unen en edificio.
    const mapaEdificios = new Map<string, GrupoMarcador>();
    const gruposIndividuales: GrupoMarcador[] = [];

    usuariosAMostrar.forEach((user) => {
      const lat = Number(user.latitud);
      const lng = Number(user.longitud);
      const esDepto = tieneCheckEdificio(user);
      const dirBase = normalizarDireccionBase(user.domicilio);

      if (esDepto && dirBase) {
        const buildingKey = `edificio_${dirBase}`;
        if (!mapaEdificios.has(buildingKey)) {
          // Generar nombre de título capitalizado (ej: "Mitre 302")
          const tituloEdificio = dirBase
            .split(" ")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" ");

          mapaEdificios.set(buildingKey, {
            lat,
            lng,
            usuarios: [],
            esEdificio: false,
            domicilioEdificio: tituloEdificio,
            buildingKey,
          });
        }
        mapaEdificios.get(buildingKey)!.usuarios.push(user);
      } else {
        // Usuario independiente o sin check de edificio:
        // Se renderiza como punto individual (no se fusiona con otros solo por estar juntos)
        gruposIndividuales.push({
          lat,
          lng,
          usuarios: [user],
          esEdificio: false,
          domicilioEdificio: user.domicilio || "Zárate",
        });
      }
    });

    mapaEdificiosRef.current = mapaEdificios;

    const gruposParaRenderizar: GrupoMarcador[] = [];

    // Edificios: solo se unifican como edificio con desplegable si tienen 2 o más departamentos/usuarios
    mapaEdificios.forEach((grupo) => {
      if (grupo.usuarios.length > 1) {
        grupo.esEdificio = true;
        gruposParaRenderizar.push(grupo);
      } else {
        // Si hay solo 1 usuario con check en esa dirección, se renderiza como marcador individual
        grupo.esEdificio = false;
        gruposParaRenderizar.push(grupo);
      }
    });

    // Agregar todos los usuarios independientes
    gruposParaRenderizar.push(...gruposIndividuales);

    let grupoIndex = 0;
    gruposParaRenderizar.forEach((grupo) => {
      grupoIndex++;
      const { lat, lng, usuarios: usuariosDelGrupo, esEdificio } = grupo;

      // Si todos los usuarios de este grupo ya están dibujados en la ruta de cortes y es 1 solo usuario,
      // no dibujamos para evitar superposiciones con el pin de parada.
      const usuariosFueraDeRuta = usuariosDelGrupo.filter((u) => !idsEnRuta.has(u.id));
      if (usuariosFueraDeRuta.length === 0 && usuariosDelGrupo.length === 1) {
        return;
      }

      boundsPoints.push([lat, lng]);

      if (esEdificio) {
        // ========================================================
        // MARCADOR DISTINTIVO DE EDIFICIO CON DESPLEGABLE COMPLETO
        // ========================================================
        const totalUsuarios = usuariosDelGrupo.length;
        const hasFraude = usuariosDelGrupo.some(
          (u) =>
            u.estado?.nombre?.toLowerCase().includes("fraude") ||
            u.estado?.id === 1
        );

        // Resumen de estados en el edificio
        const conteoEstados: Record<string, { count: number; config: any }> = {};
        for (const u of usuariosDelGrupo) {
          const cfg = obtenerConfigEstadoPorUsuario(u.estado);
          if (!conteoEstados[cfg.key]) {
            conteoEstados[cfg.key] = { count: 0, config: cfg };
          }
          conteoEstados[cfg.key].count++;
        }

        const chipsResumenHtml = Object.values(conteoEstados)
          .map(
            (item) => `
              <span class="edificio-chip">
                <span style="width: 6.5px; height: 6.5px; border-radius: 50%; background: ${item.config.dotColor || item.config.bg}; display: inline-block;"></span>
                ${item.config.emoji ? `${item.config.emoji} ` : ""}${item.count} ${item.config.nombre}
              </span>
            `
          )
          .join("");

        const domicilioEdificio =
          grupo.domicilioEdificio ||
          usuariosDelGrupo.find((u) => u.domicilio)?.domicilio ||
          "Edificio en Zárate";

        const labelEdificio = totalUsuarios === 1 ? `🏢 #${usuariosDelGrupo[0].nroUsuario}` : `🏢 ${totalUsuarios} Deptos`;
        const edificioIconHtml = `
          <div class="custom-edificio-pin">
            <div class="custom-edificio-badge ${hasFraude ? "has-fraude" : ""}">
              <span>${labelEdificio}</span>
              ${hasFraude ? `<span class="edificio-dot-fraude" title="Fraude detectado"></span>` : ""}
            </div>
            <div class="custom-edificio-tip"></div>
          </div>
        `;

        const edificioIcon = L.divIcon({
          className: "custom-edificio-marker",
          html: edificioIconHtml,
          iconSize: [105, 36],
          iconAnchor: [52.5, 33],
          popupAnchor: [0, -33],
        });

        const listaUsuariosHtml = usuariosDelGrupo
          .map((u) => {
            const config = obtenerConfigEstadoPorUsuario(u.estado);
            const infoVto = obtenerInfoVencimiento(u.fechaVto);
            const ordenParada = paradasPorUsuarioId.get(u.id);
            const estaEnRuta = ordenParada !== undefined;

            return `
              <div class="edificio-user-item" id="edificio-user-item-${u.id}" data-search="${u.nroUsuario} ${u.nombre} ${u.medidor || ""} ${u.domicilio || ""}">
                <div class="edificio-user-main-row">
                  <div class="edificio-user-id-group">
                    <span class="edificio-user-nro" style="background: ${config.bg}; color: ${config.text}; border: 1px solid ${config.border};">
                      #${u.nroUsuario}
                    </span>
                    <span class="edificio-user-estado" style="background: ${config.badgeBg}; color: ${config.badgeText}; border: 1px solid ${config.border};">
                      <span class="edificio-estado-dot" style="background: ${config.dotColor};"></span>
                      ${config.emoji ? `${config.emoji} ` : ""}${u.estado?.nombre || "Sin Estado"}
                    </span>
                    ${u.esDepartamento || u.idEstadoDepto || u.estadoDepto
                ? `<span class="edificio-depto-tag">
                            🏢 ${u.estadoDepto?.nombre || "Depto"}
                          </span>`
                : ""
              }
                  </div>
                  ${estaEnRuta ? `<span class="edificio-en-ruta-badge">En Ruta #${ordenParada}</span>` : ""}
                </div>

                <div class="edificio-user-name">${u.nombre}</div>

                <div class="edificio-user-details">
                  ${u.domicilio ? `<span><strong>Ubicación:</strong> <span class="popup-attr-badge-domicilio">${u.domicilio}</span></span>` : ""}
                  ${u.medidor ? `<span><strong>Medidor:</strong> <span class="popup-attr-badge-medidor">${u.medidor}</span></span>` : ""}
                  ${u.ruta ? `<span><strong>Ruta:</strong> <span class="popup-attr-badge-ruta">${u.ruta}</span></span>` : ""}
                  ${infoVto.texto ? `<span><strong>Vto:</strong> <span style="color: #dc2626; font-weight: 700;">${infoVto.texto}</span></span>` : ""}
                </div>

                ${u.imagenes && u.imagenes.length > 0 ? `
                  <div class="edificio-user-fotos-row">
                    <span class="edificio-fotos-badge">📸 ${u.imagenes.length} foto${u.imagenes.length > 1 ? "s" : ""}</span>
                    <div class="edificio-fotos-strip">
                      ${u.imagenes.map((img, idx) => `
                        <div class="edificio-foto-thumb" onclick="event.preventDefault(); event.stopPropagation(); window.abrirFotoFullscreenEnMapa('${encodeURIComponent(img.url)}')" title="Foto #${idx + 1} - Clic para ampliar">
                          <img src="${getValidImageUrl(img.url)}" alt="Foto" loading="lazy" />
                        </div>
                      `).join("")}
                    </div>
                  </div>
                ` : ""}

                <div class="edificio-user-actions">
                  <button
                    type="button"
                    onclick="event.preventDefault(); event.stopPropagation(); window.fijarUsuarioInicioCorte(${u.id})"
                    class="popup-btn-set-origin mini"
                    title="Fijar como punto de inicio para el cálculo automático"
                  >
                    Fijar inicio
                  </button>
                  <button
                    type="button"
                    onclick="event.preventDefault(); event.stopPropagation(); window.toggleParadaManual(${u.id})"
                    class="popup-btn-add-manual mini ${estaEnRuta ? "remove" : ""}"
                    title="${estaEnRuta ? "Quitar de la ruta" : "Sumar este usuario a la ruta manual"}"
                  >
                    ${estaEnRuta ? "Quitar" : "+ Ruta manual"}
                  </button>
                  <button
                    type="button"
                    onclick="event.preventDefault(); event.stopPropagation(); window.iniciarMoverPunto(${u.id})"
                    class="popup-btn-mover-punto mini"
                    title="Mover punto: cambiar latitud y longitud directamente en el mapa"
                  >
                    📍 Mover
                  </button>
                  <button
                    type="button"
                    onclick="event.preventDefault(); event.stopPropagation(); window.iniciarCombinarUsuario(${u.id})"
                    class="popup-btn-combinar-edificio mini"
                    title="Mover este departamento a otro edificio o combinar con otro punto"
                  >
                    🏢 Mudar
                  </button>
                  <button
                    type="button"
                    onclick="event.preventDefault(); event.stopPropagation(); window.iniciarSepararUsuarioDeEdificio(${u.id})"
                    class="popup-btn-separar-edificio mini"
                    title="Separar este usuario del edificio y convertirlo en un punto independiente"
                  >
                    ✂️ Separar
                  </button>
                </div>
              </div>
            `;
          })
          .join("");

        const grupoListId = `edificio-lista-${grupoIndex}`;

        const edificioPopupHtml = `
          <div class="edificio-popup-container">
            <div class="edificio-popup-header">
              <div class="edificio-header-title-row">
                <span class="edificio-badge-icon">🏢</span>
                <div class="edificio-title-col">
                  <h3 class="edificio-title" title="${domicilioEdificio}">${domicilioEdificio}</h3>
                  <span class="edificio-subtitle">${totalUsuarios} usuario${totalUsuarios > 1 ? "s" : ""} / departamento${totalUsuarios > 1 ? "s" : ""} en este edificio</span>
                </div>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.iniciarMoverEdificioCompleto('${grupo.buildingKey || ""}')"
                  class="popup-btn-mover-edificio-header"
                  title="Mover todo este edificio en el mapa"
                >
                  📍 Mover edificio
                </button>
              </div>
              ${chipsResumenHtml ? `<div class="edificio-resumen-chips">${chipsResumenHtml}</div>` : ""}
            </div>

            ${totalUsuarios >= 3
            ? `<div class="edificio-search-wrapper">
                    <input
                      type="text"
                      placeholder="🔍 Filtrar departamentos (#usuario, nombre, medidor)..."
                      class="edificio-search-input"
                      oninput="window.filtrarUsuariosEdificio(this, '${grupoListId}')"
                    />
                  </div>`
            : ""
          }

            <div class="edificio-users-list" id="${grupoListId}">
              ${listaUsuariosHtml}
            </div>

            <div class="edificio-popup-footer">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="edificio-gps-label">GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.iniciarMoverEdificioCompleto('${grupo.buildingKey || ""}')"
                  class="popup-btn-mover-edificio"
                  title="Mover este edificio completo y actualizar la ubicación de todos sus departamentos a la vez"
                >
                  📍 Mover edificio
                </button>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.iniciarUnirPuntosAEdificio(${lat}, ${lng}, '${encodeURIComponent(domicilioEdificio)}')"
                  class="popup-btn-add-depto-a-edificio"
                  title="Seleccionar un punto suelto en el mapa para incorporarlo a este edificio"
                >
                  + Unir punto suelto
                </button>
              </div>
              <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" class="popup-btn-maps">
                <span>Maps</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], {
          icon: edificioIcon,
          userConfig: { key: "edificio", bg: "#4f46e5", text: "#ffffff", border: "#3730a3", emoji: "🏢" },
          userEstadoKey: "edificio",
        } as any);

        marker.on("click", (e: any) => {
          if (usuarioCombinandoRef.current) {
            L.DomEvent.stopPropagation(e);
            const uOrigen = usuarioCombinandoRef.current;
            if (usuariosDelGrupo.some((u) => u.id === uOrigen.id)) {
              toast.warning("El usuario seleccionado ya forma parte de este edificio.");
              return;
            }
            setDestinoCombinacion({
              lat,
              lng,
              domicilio: domicilioEdificio,
              usuarios: usuariosDelGrupo,
              esEdificio: true,
            });
            setPisoDeptoInput("");
            return;
          }
        });

        marker.bindPopup(edificioPopupHtml, {
          maxWidth: 390,
          className: "custom-leaflet-popup-edificio",
          autoPan: true,
        });

        markersParaAgregar.push(marker);

        usuariosDelGrupo.forEach((u) => {
          userMarkersMap.current.set(u.id, marker);
        });
      } else {
        // ========================================================
        // MARCADOR INDIVIDUAL ESTÁNDAR
        // ========================================================
        const user = usuariosDelGrupo[0];
        const config = obtenerConfigEstadoPorUsuario(user.estado);
        const isFiltrado = filtrosEstadoKeys.length > 0;

        const pinHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35)); transition: transform 0.2s ease; transform-origin: bottom center;" class="custom-user-pin ${config.key}">
            <div style="
              background: ${config.bg};
              color: ${config.text};
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              font-weight: 800;
              padding: 3px 8px;
              border-radius: 12px;
              box-shadow: ${isFiltrado ? `0 0 0 3px ${config.bg}, 0 6px 16px rgba(0, 0, 0, 0.45)` : "0 4px 10px rgba(0, 0, 0, 0.25)"};
              border: ${isFiltrado ? "2.5px solid #ffffff" : "2px solid #ffffff"};
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
              transform: ${isFiltrado ? "scale(1.12)" : "scale(1)"};
              transform-origin: bottom center;
            ">
              ${config.emoji ? `<span style="font-size: 11px;">${config.emoji}</span>` : ""}
              <span>#${user.nroUsuario}</span>
              ${user.imagenes && user.imagenes.length > 0 ? `<span style="font-size: 10px; margin-left: 2px;" title="${user.imagenes.length} fotografía(s) registrada(s)">📸</span>` : ""}
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid ${config.bg};
              margin-top: -1px;
              transform: ${isFiltrado ? "scale(1.1)" : "scale(1)"};
              transform-origin: top center;
            "></div>
          </div>
        `;

        const userIcon = L.divIcon({
          className: "custom-user-marker",
          html: pinHtml,
          iconSize: [85, 34],
          iconAnchor: [42.5, 31],
          popupAnchor: [0, -31],
        });

        const infoVto = obtenerInfoVencimiento(user.fechaVto);

        const popupHtml = `
          <div class="custom-map-popup">
            <div class="popup-user-header">
              <span class="popup-user-badge" style="background: ${config.bg}; color: ${config.text}; border: 1px solid ${config.border}; font-weight: 800;">
                #${user.nroUsuario}
              </span>
              ${user.estado
            ? `<span class="popup-estado-badge" style="background: ${config.badgeBg}; color: ${config.badgeText}; border: 1px solid ${config.border}; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
                      <span style="width: 6.5px; height: 6.5px; border-radius: 50%; background: ${config.dotColor}; flex-shrink: 0; display: inline-block;"></span>
                      ${config.emoji ? `${config.emoji} ` : ""}${user.estado.nombre}
                    </span>`
            : `<span class="popup-estado-badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
                      <span style="width: 6.5px; height: 6.5px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; display: inline-block;"></span>
                      Sin Estado
                    </span>`
          }
            </div>
            <h4 class="popup-user-name">${user.nombre}</h4>
            ${user.domicilio
            ? `<div class="popup-user-info-row">
                    <span><strong>Domicilio:</strong> <span class="popup-attr-badge-domicilio">${user.domicilio}</span></span>
                  </div>`
            : ""
          }
            ${user.medidor
            ? `<div class="popup-user-info-row">
                    <span><strong>Medidor:</strong> <span class="popup-attr-badge-medidor">${user.medidor}</span></span>
                  </div>`
            : ""
          }
            ${user.ruta
            ? `<div class="popup-user-info-row">
                    <span><strong>Ruta:</strong> <span class="popup-attr-badge-ruta">${user.ruta}</span></span>
                  </div>`
            : ""
          }
            <div class="popup-user-info-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
              <span><strong>Vto:</strong> <span style="color: #dc2626; font-weight: 700;">${infoVto.texto}</span></span>
            </div>
            <div class="popup-user-info-row" style="margin-top: 4px; font-size: 11px; color: #64748b;">
              <span><strong>GPS:</strong> <span style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #0284c7;">${lat.toFixed(6)}, ${lng.toFixed(6)}</span></span>
            </div>

            ${user.imagenes && user.imagenes.length > 0 ? `
              <div class="popup-fotos-container">
                <div class="popup-fotos-header">
                  <span class="popup-fotos-title">📸 Fotos Registradas (${user.imagenes.length})</span>
                  <span class="popup-fotos-hint">Clic para ampliar</span>
                </div>
                <div class="popup-fotos-grid">
                  ${user.imagenes.map((img, idx) => `
                    <div class="popup-foto-card" onclick="event.preventDefault(); event.stopPropagation(); window.abrirFotoFullscreenEnMapa('${encodeURIComponent(img.url)}')" title="Foto #${idx + 1} - Clic para ampliar en pantalla completa">
                      <img src="${getValidImageUrl(img.url)}" alt="Foto ${idx + 1}" class="popup-foto-img" loading="lazy" />
                      <div class="popup-foto-zoom-badge">🔍</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : `
              <div class="popup-sin-fotos">
                <span>📷 Sin fotografías registradas</span>
              </div>
            `}
            <div class="popup-footer-action" style="gap: 6px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.fijarUsuarioInicioCorte(${user.id})"
                  class="popup-btn-set-origin"
                  title="Fijar como punto de inicio para el cálculo automático"
                >
                  Fijar inicio
                </button>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.toggleParadaManual(${user.id})"
                  class="popup-btn-add-manual"
                  title="Sumar este fraude a la secuencia de paradas manuales"
                >
                  + Ruta manual
                </button>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.iniciarMoverPunto(${user.id})"
                  class="popup-btn-mover-punto"
                  title="Mover punto: cambiar latitud y longitud directamente en el mapa"
                >
                  📍 Mover punto
                </button>
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); window.iniciarCombinarUsuario(${user.id})"
                  class="popup-btn-combinar-edificio"
                  title="Combinar este punto suelto con un edificio u otro departamento"
                >
                  🏢 Unir a edificio
                </button>
              </div>
              <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" class="popup-btn-maps">
                <span>Maps</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], {
          icon: userIcon,
          userConfig: config,
          userEstadoKey: config.key,
        } as any);

        marker.on("click", (e: any) => {
          if (usuarioCombinandoRef.current) {
            L.DomEvent.stopPropagation(e);
            const uOrigen = usuarioCombinandoRef.current;
            if (uOrigen.id === user.id) {
              toast.warning("Selecciona otro edificio o usuario diferente para combinar.");
              return;
            }
            setDestinoCombinacion({
              lat,
              lng,
              domicilio: user.domicilio || "Ubicación en Zárate",
              usuarios: [user],
              esEdificio: false,
            });
            setPisoDeptoInput("");
            return;
          }
          if (destinoCombinacionRef.current && !usuarioCombinandoRef.current) {
            L.DomEvent.stopPropagation(e);
            setUsuarioCombinando(user);
            setPisoDeptoInput("");
            return;
          }
          if (modoPlanificadorRef.current === "manual" && clickDirectoManualRef.current) {
            L.DomEvent.stopPropagation(e);
            (window as any).toggleParadaManual(user.id);
          }
        });

        marker.bindPopup(popupHtml, {
          maxWidth: 320,
          className: "custom-leaflet-popup",
          autoPan: false,
        });

        markersParaAgregar.push(marker);
        userMarkersMap.current.set(user.id, marker);
      }
    });

    if (markersLayerRef.current.addLayers) {
      markersLayerRef.current.addLayers(markersParaAgregar);
    } else {
      markersParaAgregar.forEach((m) => markersLayerRef.current.addLayer(m));
    }

    // Si había un usuario pendiente de enfocar tras cambiar de ruta, lo enfocamos
    if (usuarioPendienteEnfoqueRef.current) {
      const targetId = usuarioPendienteEnfoqueRef.current;
      usuarioPendienteEnfoqueRef.current = null;
      setTimeout(() => {
        enfocarMarcador(targetId);
      }, 400);
    }
  }, [usuariosAMostrar, resultadoRuta, filtrosEstadoKeys, mapReady]);

  // Dibujar la ruta y los marcadores ordenados de paradas
  const dibujarRutaEnMapa = (res: ResultadoRuta) => {
    if (!mapInstanceRef.current || !routeLayerRef.current || !LRef.current) return;
    const L = LRef.current;

    routeLayerRef.current.clearLayers();

    const latlngs: [number, number][] = [];

    res.paradas.forEach((parada) => {
      const { latitud, longitud, orden, usuario, distanciaDesdeAnteriorMetros, distanciaAcumuladaMetros } = parada;
      latlngs.push([latitud, longitud]);

      const esInicio = orden === 1;

      const markerHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="
            background: ${esInicio ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)"};
            color: #ffffff;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 14px;
            box-shadow: 0 4px 12px ${esInicio ? "rgba(5, 150, 105, 0.5)" : "rgba(2, 132, 199, 0.5)"};
            border: 2.5px solid #ffffff;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>${esInicio ? "Inicio" : `Parada ${orden}`}</span>
            <span>#${usuario.nroUsuario}</span>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 7px solid ${esInicio ? "#059669" : "#0284c7"};
            margin-top: -1px;
          "></div>
        </div>
      `;

      const routeIcon = L.divIcon({
        className: "custom-route-marker",
        html: markerHtml,
        iconSize: [100, 36],
        iconAnchor: [50, 34],
        popupAnchor: [0, -34],
      });

      const popupHtml = `
        <div class="custom-map-popup">
          <div class="popup-user-header">
            <span class="popup-user-badge" style="background: ${esInicio ? "#059669" : "#0284c7"}">
              ${esInicio ? "Punto de Partida" : `Parada de Corte #${orden}`}
            </span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #475569;">
              #${usuario.nroUsuario}
            </span>
          </div>
          <h4 class="popup-user-name">${usuario.nombre}</h4>
          ${usuario.domicilio
          ? `<div class="popup-user-info-row">
                  <span><strong>Domicilio:</strong> <span class="popup-attr-badge-domicilio">${usuario.domicilio}</span></span>
                </div>`
          : ""
        }
          ${usuario.medidor
          ? `<div class="popup-user-info-row">
                  <span><strong>Medidor:</strong> <span class="popup-attr-badge-medidor">${usuario.medidor}</span></span>
                </div>`
          : ""
        }
          <div class="popup-user-info-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <span><strong>Tramo:</strong> ${orden === 1 ? "Inicio" : formatearDistancia(distanciaDesdeAnteriorMetros)}</span>
          </div>
          <div class="popup-user-info-row">
            <span><strong>Acumulado:</strong> ${formatearDistancia(distanciaAcumuladaMetros)}</span>
          </div>
          <div class="popup-footer-action" style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
              <button
                type="button"
                onclick="window.toggleParadaManual(${usuario.id})"
                class="popup-btn-add-manual remove"
                title="Quitar esta parada de la ruta"
              >
                Quitar
              </button>
              <button
                type="button"
                onclick="event.preventDefault(); event.stopPropagation(); window.iniciarMoverPunto(${usuario.id})"
                class="popup-btn-mover-punto"
                title="Mover punto: cambiar latitud y longitud en el mapa"
              >
                📍 Mover punto
              </button>
              ${orden > 1
          ? `<button
                      type="button"
                      onclick="window.moverParadaManual(${usuario.id}, -1)"
                      class="popup-btn-reorder"
                      title="Mover parada antes en la secuencia"
                    >
                      ↑ Subir
                    </button>`
          : ""
        }
              ${orden < res.paradas.length
          ? `<button
                      type="button"
                      onclick="window.moverParadaManual(${usuario.id}, 1)"
                      class="popup-btn-reorder"
                      title="Mover parada después en la secuencia"
                    >
                      ↓ Bajar
                    </button>`
          : ""
        }
            </div>
            <a href="https://www.google.com/maps?q=${latitud},${longitud}" target="_blank" rel="noopener noreferrer" class="popup-btn-maps">
              <span>Maps</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      `;

      const marker = L.marker([latitud, longitud], { icon: routeIcon });

      marker.on("click", (e: any) => {
        if (modoPlanificadorRef.current === "manual" && clickDirectoManualRef.current) {
          L.DomEvent.stopPropagation(e);
          (window as any).toggleParadaManual(usuario.id);
        }
      });

      marker.bindPopup(popupHtml, {
        maxWidth: 290,
      });

      routeLayerRef.current.addLayer(marker);
    });

    // Trazar línea poligonal de la ruta (geometría real de calles si está disponible)
    const puntosPolilinea =
      res.geometriaCalles && res.geometriaCalles.length > 0
        ? res.geometriaCalles
        : latlngs;

    if (puntosPolilinea.length > 1) {
      // Línea de base/sombra (efecto de vía en Google Maps)
      const polylineBg = L.polyline(puntosPolilinea, {
        color: "#1e3a8a",
        weight: 7,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      });

      // Línea principal de trazado por las calles
      const polyline = L.polyline(puntosPolilinea, {
        color: res.esRutaPorCalles ? "#2563eb" : "#0284c7",
        weight: 5,
        opacity: 0.95,
        dashArray: res.esRutaPorCalles ? undefined : "8, 8",
        lineCap: "round",
        lineJoin: "round",
      });

      routeLayerRef.current.addLayer(polylineBg);
      routeLayerRef.current.addLayer(polyline);

      // La cámara se mantiene estática para evitar saltos
    }
  };

  // Función central para actualizar la ruta y consultar el trazado real por calles (OSRM)
  const actualizarRutaConCalles = async (resultadoBase: ResultadoRuta | null) => {
    if (!resultadoBase || resultadoBase.paradas.length === 0) {
      setResultadoRuta(null);
      if (routeLayerRef.current) routeLayerRef.current.clearLayers();
      return;
    }

    // 1. Mostrar de inmediato la ruta base y ubicar marcadores
    setResultadoRuta(resultadoBase);
    dibujarRutaEnMapa(resultadoBase);

    // 2. Si hay 2 o más paradas, consultar el trazado vial y distancias reales por calles
    if (resultadoBase.paradas.length >= 2) {
      const datosCalles = await obtenerRutaPorCalles(resultadoBase.paradas);
      if (datosCalles) {
        const rutaCalles = aplicarRutaPorCalles(resultadoBase, datosCalles);
        setResultadoRuta(rutaCalles);
        dibujarRutaEnMapa(rutaCalles);
      }
    }
  };
  actualizarRutaConCallesRef.current = actualizarRutaConCalles;

  // Calcular ruta óptima (SOLO sobre los filtros puestos en ese momento)
  const handleCalcularRuta = () => {
    if (!usuarioInicioId) {
      toast.warning("Por favor selecciona un punto de partida para el operativo de cortes.");
      return;
    }

    const inicio = usuarios.find((u) => u.id === usuarioInicioId);
    if (!inicio || inicio.latitud === null || inicio.longitud === null) {
      toast.warning("El usuario seleccionado no tiene coordenadas asignadas.");
      return;
    }

    // Filtrar el conjunto de candidatos considerando estrictamente los filtros puestos en ese momento
    const candidatosRuta = usuarios.filter((u) => {
      if (filtrosEstadoKeys.length === 0) return true;
      const c = obtenerConfigEstadoPorUsuario(u.estado);
      return filtrosEstadoKeys.includes(c.key);
    });

    if (candidatosRuta.length === 0) {
      toast.warning("No hay usuarios en los estados filtrados para calcular la ruta de cortes.");
      return;
    }

    const res = calcularRutaOptimaCortes(inicio, candidatosRuta, cantidadCortes);
    if (!res || res.paradas.length === 0) {
      toast.error("No se pudo calcular la ruta de cortes.");
      return;
    }

    actualizarRutaConCalles(res);
    toast.success(
      `¡Ruta calculada para ${res.paradas.length} cortes considerando solo los filtros seleccionados!`
    );
  };

  // Limpiar ruta activa
  const handleLimpiarRuta = () => {
    setResultadoRuta(null);
    setParadasManuales([]);
    setCuadrillasSeleccionadasRuta([]);
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
    toast.info("Ruta de cortes limpiada del mapa.");
  };

  // Agregar parada manual desde selector
  const agregarParadaManual = (usuario: UsuarioGeo) => {
    if (paradasManuales.some((p) => p.id === usuario.id)) {
      toast.info(`El usuario #${usuario.nroUsuario} ya está en la ruta manual.`);
      return;
    }

    const nuevaLista = [...paradasManuales, usuario];
    setParadasManuales(nuevaLista);

    const res = construirRutaManual(nuevaLista);
    actualizarRutaConCalles(res);
    toast.success(`Parada #${nuevaLista.length}: Usuario #${usuario.nroUsuario} agregado`);
  };

  // Quitar parada manual
  const removerParadaManual = (usuarioId: number) => {
    const nuevaLista = paradasManuales.filter((p) => p.id !== usuarioId);
    setParadasManuales(nuevaLista);

    if (nuevaLista.length > 0) {
      const res = construirRutaManual(nuevaLista);
      actualizarRutaConCalles(res);
    } else {
      setResultadoRuta(null);
      if (routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
    }
  };

  // Reordenar parada manual (mover arriba o abajo en la lista)
  const moverParadaIndex = (index: number, direccion: -1 | 1) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= paradasManuales.length) return;
    const copia = [...paradasManuales];
    const item = copia.splice(index, 1)[0];
    copia.splice(nuevoIndex, 0, item);
    setParadasManuales(copia);
    const res = construirRutaManual(copia);
    actualizarRutaConCalles(res);
  };

  // Optimizar el orden de las paradas manuales por cercanía
  const handleOptimizarOrdenManual = () => {
    if (paradasManuales.length <= 2) {
      toast.info("Se necesitan al menos 3 paradas para optimizar el orden.");
      return;
    }

    const inicio = paradasManuales[0];
    const res = calcularRutaOptimaCortes(inicio, paradasManuales, paradasManuales.length);
    if (!res) return;

    const reordenadas = res.paradas.map((p) => p.usuario as UsuarioGeo);
    setParadasManuales(reordenadas);
    actualizarRutaConCalles(res);
    toast.success(`¡Orden optimizado por cercanía para ${reordenadas.length} ubicaciones!`);
  };

  // Invertir recorrido manual
  const handleInvertirOrdenManual = () => {
    if (paradasManuales.length <= 1) return;
    const invertidas = [...paradasManuales].reverse();
    setParadasManuales(invertidas);
    const res = construirRutaManual(invertidas);
    actualizarRutaConCalles(res);
    toast.info("Recorrido invertido.");
  };

  // Alternar selección de cuadrilla para la ruta
  const toggleCuadrillaRuta = (id: number) => {
    setCuadrillasSeleccionadasRuta((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Asignar masivamente las cuadrillas a toda la ruta completa
  const handleAsignarCuadrillasRuta = async () => {
    if (!resultadoRuta || resultadoRuta.paradas.length === 0) return;
    if (cuadrillasSeleccionadasRuta.length === 0) {
      toast.warning("Selecciona al menos una cuadrilla para asignar a la ruta.");
      return;
    }

    setAsignandoCuadrillas(true);
    try {
      const userIds = resultadoRuta.paradas.map((p) => p.usuario.id);
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds,
          cuadrillaIds: cuadrillasSeleccionadasRuta,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al asignar cuadrillas");
      }

      // Cuadrillas actualizadas
      const nuevasCuadrillas = cuadrillasDisponibles.filter((c) =>
        cuadrillasSeleccionadasRuta.includes(c.id)
      );

      // Actualizar estado de usuarios en memoria
      setUsuarios((prev) =>
        prev.map((u) => {
          if (userIds.includes(u.id)) {
            return {
              ...u,
              cuadrillas: nuevasCuadrillas,
            };
          }
          return u;
        })
      );

      // Actualizar estado de paradas de la ruta en memoria y redibujar
      const rutaActualizada: ResultadoRuta = {
        ...resultadoRuta,
        paradas: resultadoRuta.paradas.map((p) => ({
          ...p,
          usuario: {
            ...p.usuario,
            cuadrillas: nuevasCuadrillas,
          },
        })),
      };

      setResultadoRuta(rutaActualizada);
      dibujarRutaEnMapa(rutaActualizada);

      toast.success(
        `¡Cuadrillas asignadas exitosamente a los ${userIds.length} usuarios de la ruta!`
      );
    } catch (err: any) {
      console.error("Error al asignar cuadrillas a la ruta:", err);
      toast.error(err.message || "Error al actualizar cuadrillas");
    } finally {
      setAsignandoCuadrillas(false);
    }
  };

  // Descargar Excel con la ruta y los datos completos de fraudes
  const handleDescargarExcel = () => {
    if (!resultadoRuta) {
      toast.warning("Calcula primero una ruta de cortes para exportar el plan operativo.");
      return;
    }
    descargarExcelRutaOperativo(resultadoRuta, usuarios);
    toast.success("¡Planilla Excel descargada con Hoja de Ruta y Listado de Fraudes!");
  };

  // Exportar captura visual completa del mapa con los fraudes en formato PNG
  const handleExportarMapaImagen = async () => {
    if (!mapContainerRef.current) {
      toast.error("No se encontró el lienzo del mapa para exportar.");
      return;
    }

    try {
      setExportandoMapa(true);
      toast.info("📸 Generando imagen de alta resolución del mapa con los fraudes...", { autoClose: 2500 });

      // Importar html2canvas de forma dinámica en el cliente
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      // Breve pausa para asegurar estabilidad en tiles y marcadores
      await new Promise((resolve) => setTimeout(resolve, 200));

      const element = mapContainerRef.current;

      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: false,
        scale: 2, // 2x para resolución Retina y nitidez profesional
        backgroundColor: "#cbd5e1",
        logging: false,
        ignoreElements: (el) => {
          // Ocultar botones de zoom y atribución de Leaflet en la imagen
          return (
            el.classList.contains("leaflet-control-zoom") ||
            el.classList.contains("leaflet-control-attribution")
          );
        },
      });

      // Dibujar etiqueta informativa profesional en la esquina superior izquierda
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const scale = 2;
        const padding = 16 * scale;
        const barWidth = 350 * scale;
        const barHeight = 58 * scale;
        const x = padding;
        const y = padding;

        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(x, y, barWidth, barHeight, 10 * scale);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillText("⚡ SISTEMA ANTIFRAUDE ZÁRATE", x + 14 * scale, y + 24 * scale);

        ctx.fillStyle = "#93c5fd";
        ctx.font = `600 ${10.5 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const rutaTexto = rutaActiva ? `Ruta ${rutaActiva}` : "Todas las rutas";
        const cantidadFraudes = `${usuariosAMostrar.length} fraudes visibles`;
        const fechaTexto = new Date().toLocaleDateString("es-AR");
        ctx.fillText(`${rutaTexto} • ${cantidadFraudes} • ${fechaTexto}`, x + 14 * scale, y + 44 * scale);
        ctx.restore();
      }

      // Convertir a PNG y disparar descarga automática
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const fechaArchivo = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `mapa-fraudes-zarate${rutaActiva ? `-ruta-${rutaActiva}` : ""}-${fechaArchivo}.png`;
      link.download = nombreArchivo;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("✅ ¡Mapa exportado con éxito como imagen PNG!");
    } catch (error: any) {
      console.error("Error al exportar mapa a imagen:", error);
      toast.error("Ocurrió un error al capturar la imagen del mapa.");
    } finally {
      setExportandoMapa(false);
    }
  };

  // Exportar mapa a KML para Google Earth / Google Maps (con colores e iconos oficiales por estado)
  const handleExportarKML = () => {
    try {
      const listaExportar = (usuariosAMostrar && usuariosAMostrar.length > 0)
        ? usuariosAMostrar
        : usuariosGeoreferenciados;

      if (!listaExportar || listaExportar.length === 0) {
        toast.warning("No hay usuarios con ubicación geográfica en la ruta para exportar.");
        return;
      }

      toast.info("🗺️ Generando archivo KML con íconos de colores para Google Maps...", { autoClose: 2000 });
      const ok = exportarMapaKML({
        usuarios: listaExportar,
        rutaActiva,
      });

      if (ok) {
        toast.success("✅ ¡Archivo KML descargado! Cada estado tiene su color e ícono oficial para que no se mezclen en Google Maps.");
      } else {
        toast.warning("No se encontraron puntos con coordenadas válidas para exportar.");
      }
    } catch (err: any) {
      console.error("Error al exportar KML:", err);
      toast.error("Error al exportar archivo KML.");
    }
  };

  const resaltarMarcador = (marker: any) => {
    try {
      const el = marker.getElement();
      if (el) {
        el.classList.add("marker-highlight-pulse");
        setTimeout(() => {
          el.classList.remove("marker-highlight-pulse");
        }, 3500);
      }
    } catch { }
  };

  const enfocarMarcador = (usuarioId: number) => {
    const marker = userMarkersMap.current.get(usuarioId);
    const u = (usuariosRef.current || usuarios).find((user) => user.id === usuarioId);
    if (!u) return;

    if (marker && mapInstanceRef.current) {
      const latlng = marker.getLatLng();
      mapInstanceRef.current.setView(latlng, 19, { animate: true });
      if (markersLayerRef.current?.zoomToShowLayer) {
        markersLayerRef.current.zoomToShowLayer(marker, () => {
          setTimeout(() => {
            marker.openPopup();
            resaltarMarcador(marker);
            setTimeout(() => {
              const elUser = document.getElementById(`edificio-user-item-${usuarioId}`);
              if (elUser) {
                elUser.scrollIntoView({ behavior: "smooth", block: "nearest" });
                elUser.classList.add("edificio-user-highlight");
                setTimeout(() => elUser.classList.remove("edificio-user-highlight"), 2500);
              }
            }, 250);
          }, 150);
        });
      } else {
        setTimeout(() => {
          marker.openPopup();
          resaltarMarcador(marker);
          setTimeout(() => {
            const elUser = document.getElementById(`edificio-user-item-${usuarioId}`);
            if (elUser) {
              elUser.scrollIntoView({ behavior: "smooth", block: "nearest" });
              elUser.classList.add("edificio-user-highlight");
              setTimeout(() => elUser.classList.remove("edificio-user-highlight"), 2500);
            }
          }, 250);
        }, 150);
      }
    } else if (u.latitud && u.longitud && mapInstanceRef.current) {
      mapInstanceRef.current.setView([Number(u.latitud), Number(u.longitud)], 19, { animate: true });
      toast.info(`Usuario #${u.nroUsuario} (${u.domicilio || "Zárate"})`);
    } else {
      toast.warning(`Usuario #${u.nroUsuario} no tiene ubicación en el mapa.`);
    }
  };

  // Manejar la selección de cualquier usuario buscado: navega a su ruta y enfoca exactamente su marcador
  const handleSeleccionarUsuarioBuscado = (u: UsuarioGeo) => {
    setSearchDropdownOpen(false);
    setSearchFilter("");

    const rutaDestino = u.ruta ? normalizarRuta(u.ruta) : null;
    const rutaActualNorm = rutaActiva ? normalizarRuta(rutaActiva) : null;

    // Si el usuario pertenece a otra ruta distinta a la actualmente activa (o aún no hay ruta activa seleccionada)
    if (rutaDestino && rutaDestino !== rutaActualNorm) {
      toast.info(`Cambiando a Ruta ${rutaDestino} y ubicando a #${u.nroUsuario} (${u.nombre})...`, {
        autoClose: 2500,
      });

      // Guardamos la referencia para enfocar apenas se rendericen los marcadores de la nueva ruta
      usuarioPendienteEnfoqueRef.current = u.id;

      // Si tiene coordenadas, movemos la cámara de inmediato hacia la ubicación
      if (u.latitud && u.longitud && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([Number(u.latitud), Number(u.longitud)], 19, {
          duration: 1.2,
        });
      }

      setRutaEscrita(rutaDestino);
      setRutaActiva(rutaDestino);
      return;
    }

    // Si ya estamos en la misma ruta activa
    if (u.latitud && u.longitud) {
      enfocarMarcador(u.id);
    } else {
      toast.warning(`El usuario #${u.nroUsuario} (${u.nombre}) no cuenta con coordenadas GPS.`);
    }
  };

  const handleFocusUsuario = (target: number | UsuarioGeo) => {
    const u = typeof target === "number" ? usuarios.find((user) => user.id === target) : target;
    if (!u) return;
    handleSeleccionarUsuarioBuscado(u);
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(ZARATE_CENTER, DEFAULT_ZOOM, { duration: 1 });
    }
  };

  // Resultados de búsqueda globales combinados (base de datos completa + ruta activa)
  const usuariosFiltrados = useMemo(() => {
    const term = searchFilter.toLowerCase().trim();
    if (!term) return [];

    const mapIds = new Set<number>();
    const lista: UsuarioGeo[] = [];

    // Priorizar resultados remotos (búsqueda global en toda la base de datos)
    for (const u of resultadosRemotos) {
      if (!mapIds.has(u.id)) {
        mapIds.add(u.id);
        lista.push(u);
      }
    }

    // Complementar con usuarios de la ruta activa si coinciden
    for (const u of usuarios) {
      if (!mapIds.has(u.id)) {
        const match =
          u.nroUsuario?.toLowerCase().includes(term) ||
          u.nombre?.toLowerCase().includes(term) ||
          (u.domicilio && u.domicilio.toLowerCase().includes(term)) ||
          (u.medidor && u.medidor.toLowerCase().includes(term));
        if (match) {
          mapIds.add(u.id);
          lista.push(u);
        }
      }
    }

    return lista.slice(0, 40);
  }, [searchFilter, resultadosRemotos, usuarios]);

  return (
    <div
      ref={cardContainerRef}
      className={`mapa-general-card ${esPantallaCompleta ? "fullscreen-mode" : ""} ${usuarioMoviendo ? "modo-moviendo-punto" : ""}`}
    >
      {/* Cabecera Principal del Mapa */}
      <div className="mapa-general-header">
        <div className="mapa-general-title-block">
          <div className="mapa-general-icon-wrap">🗺️</div>
          <div>
            <h2 className="mapa-general-title">Mapa de Fraudes y Planificador de Cortes (Zárate)</h2>
            <p className="mapa-general-subtitle">
              Visualización geoespacial de fraudes y optimización de rutas operativas de corte
            </p>
          </div>
        </div>

        <div className="mapa-general-controls">
          {/* CONTROL DE RUTA OBLIGATORIO CON BOTÓN DE BÚSQUEDA */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBuscarRuta();
            }}
            className="mapa-header-ruta-box"
          >
            <span className="mapa-header-ruta-label">Ruta *:</span>
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <input
                type="text"
                inputMode="numeric"
                className={`mapa-header-ruta-input ${rutaError ? "is-invalid" : rutaActiva ? "is-valid" : ""
                  }`}
                placeholder="Ej: 301"
                value={rutaEscrita}
                onChange={(e) => handleInputRuta(e.target.value)}
                title="Filtro obligatorio de ruta: 1 al 78, 201 al 212, 301, 302 y 303. Presiona Enter o el botón Buscar."
              />
              {rutaEscrita && (
                <button
                  type="button"
                  className="btn-header-clear-ruta"
                  onClick={handleResetFiltroRuta}
                  title="Limpiar ruta"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn-header-buscar-ruta"
              disabled={cargandoRuta || !rutaEscrita.trim()}
              title="Buscar y cargar los usuarios de esta ruta"
            >
              {cargandoRuta ? "⏳" : "🔍 Buscar"}
            </button>

            {rutaActiva && !cargandoRuta && (
              <span className="badge-ruta-activa" title={`Ruta ${rutaActiva} activa`}>
                ✓ R{rutaActiva}
              </span>
            )}

            {rutaError && (
              <span className="badge-ruta-error" title={rutaError}>
                ⚠️ Inválida
              </span>
            )}
          </form>

          {/* Estadísticas de la ruta activa y botón para ver usuarios no localizados en Maps */}
          {rutaActiva && (
            <>
              <div className="mapa-stats-pill">
                <span>Fraudes Ruta {rutaActiva}:</span>
                <strong>{usuariosGeoreferenciados.length}</strong>
              </div>

              {usuariosSinGeo.length > 0 && (
                <button
                  type="button"
                  className="btn-sin-geo-pill"
                  onClick={() => setShowModalSinGeo(true)}
                  title="Ver usuarios de esta ruta no encontrados en Google Maps"
                >
                  <span>⚠️</span>
                  <span>{usuariosSinGeo.length} sin Maps</span>
                  <span className="btn-sin-geo-ver">Ver</span>
                </button>
              )}
            </>
          )}

          {/* Buscador global de usuarios (por nombre, N°, medidor o calle en cualquier ruta) */}
          <div ref={searchContainerRef} style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, N° usuario, medidor o calle..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchFilter.trim().length > 0) setSearchDropdownOpen(true);
              }}
              className="mapa-filter-input"
              style={{ minWidth: "290px" }}
              title="Buscar cualquier usuario por nombre, número de cuenta, medidor o calle en cualquier ruta"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => {
                  setSearchFilter("");
                  setSearchDropdownOpen(false);
                }}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                ✕
              </button>
            )}

            {searchDropdownOpen && searchFilter.trim().length >= 1 && (
              <div className="mapa-search-dropdown-menu">
                {buscandoRemoto && (
                  <div className="search-dropdown-loading">
                    <span>⏳</span> Buscando usuarios en todo el sistema...
                  </div>
                )}

                {usuariosFiltrados.length === 0 && !buscandoRemoto && (
                  <div style={{ padding: "16px", textAlign: "center", fontSize: "12.5px", color: "#64748b" }}>
                    No se encontraron usuarios coincidentes con &quot;{searchFilter}&quot;
                  </div>
                )}

                {usuariosFiltrados.map((u) => {
                  const tieneCoords = u.latitud !== null && u.longitud !== null && !isNaN(Number(u.latitud));
                  const configEst = obtenerConfigEstadoPorUsuario(u.estado);
                  return (
                    <div
                      key={u.id}
                      className="search-dropdown-item"
                      onClick={() => handleSeleccionarUsuarioBuscado(u)}
                    >
                      <div className="search-item-col-left">
                        <div className="search-item-header">
                          <span className="search-item-nro">#{u.nroUsuario}</span>
                          <span className="search-item-nombre">{u.nombre}</span>
                          {u.ruta ? (
                            <span className="search-item-ruta-tag">
                              🧭 Ruta {normalizarRuta(u.ruta)}
                            </span>
                          ) : (
                            <span style={{ fontSize: "10.5px", color: "#94a3b8", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                              Sin ruta
                            </span>
                          )}
                        </div>

                        <div className="search-item-details">
                          <span>📍 {u.domicilio || "Sin domicilio registrado"}</span>
                          {u.medidor && <span>• Medidor: {u.medidor}</span>}
                          <span>•</span>
                          {tieneCoords ? (
                            <span className="search-item-has-gps">✓ Con GPS</span>
                          ) : (
                            <span className="search-item-no-gps">⚠️ Sin GPS</span>
                          )}
                        </div>
                      </div>

                      <div className="search-item-col-right">
                        <span
                          className="search-item-estado-pill"
                          style={{
                            background: configEst.bg,
                            color: configEst.text,
                            border: `1px solid ${configEst.border}`,
                          }}
                        >
                          {configEst.emoji} {u.estado?.nombre || "Sin estado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn-map-action"
            onClick={handleResetView}
            style={{ padding: "7px 12px", borderRadius: "8px" }}
          >
            🎯 Centrar Zárate
          </button>

          {/* Botón Pantalla Completa */}
          <button
            type="button"
            className={`btn-map-action ${esPantallaCompleta ? "active" : ""}`}
            onClick={togglePantallaCompleta}
            title={esPantallaCompleta ? "Salir de pantalla completa (Esc)" : "Ampliar mapa a pantalla completa"}
            style={{ padding: "7px 12px", borderRadius: "8px" }}
          >
            {esPantallaCompleta ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span>Salir Pantalla Completa</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
                <span>Pantalla Completa</span>
              </>
            )}
          </button>

          {/* Menú Desplegable: Exportar Mapa (Opción 1: HTML interactivo, Opción 3: KML Google Earth, Captura PNG) */}
          <div ref={menuExportarRef} style={{ position: "relative" }}>
            <button
              type="button"
              className={`btn-exportar-mapa ${menuExportarAbierto ? "active" : ""}`}
              onClick={toggleMenuExportar}
              disabled={exportandoMapa}
              title="Opciones de exportación: Mapa interactivo HTML (solo lectura), KML Google Earth o Imagen PNG"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exportar Mapa ▾</span>
            </button>

            {menuExportarAbierto && (
              <div className={`mapa-exportar-dropdown-menu align-${menuExportarAlineacion}`}>
                {/* 1. Archivo KML con colores oficiales para Google Maps */}
                <button
                  type="button"
                  className="exportar-menu-item"
                  onClick={() => {
                    setMenuExportarAbierto(false);
                    handleExportarKML();
                  }}
                >
                  <div className="exportar-item-icon" style={{ background: "#ede9fe", color: "#6366f1" }}>
                    🗺️
                  </div>
                  <div className="exportar-item-text">
                    <span className="exportar-item-title">
                      Archivo KML (Google Maps / Earth) <span className="exportar-tag-opt">Google Maps</span>
                    </span>
                    <span className="exportar-item-desc">
                      Descarga .kml con colores e íconos oficiales según cada estado para que no se mezclen.
                    </span>
                  </div>
                </button>

                <div className="exportar-menu-divider" />

                {/* 4. Captura PNG */}
                <button
                  type="button"
                  className="exportar-menu-item"
                  onClick={() => {
                    setMenuExportarAbierto(false);
                    handleExportarMapaImagen();
                  }}
                >
                  <div className="exportar-item-icon" style={{ background: "#f1f5f9", color: "#475569" }}>
                    📸
                  </div>
                  <div className="exportar-item-text">
                    <span className="exportar-item-title">Captura de Imagen (PNG)</span>
                    <span className="exportar-item-desc">
                      Foto fija en alta resolución con el estado actual del mapa.
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Botón Crear Ruta: Muestra / Oculta las opciones de ruta manual y automática */}
          <button
            type="button"
            className={`btn-crear-ruta ${mostrarPlanificadorRuta ? "active" : ""}`}
            onClick={() => {
              setMostrarPlanificadorRuta((prev) => !prev);
              setTimeout(() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.invalidateSize();
                }
              }, 200);
            }}
            title="Crear ruta de cortes (automática por cercanía o manual punto por punto)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            <span>Crear ruta</span>
            {resultadoRuta && (
              <span className="ruta-badge">
                {resultadoRuta.paradas.length} paradas
              </span>
            )}
            <span style={{ fontSize: "11px", opacity: 0.85 }}>
              {mostrarPlanificadorRuta ? "▲" : "▼"}
            </span>
          </button>
        </div>
      </div>

      {/* Lienzo del mapa Leaflet */}
      <div className="mapa-general-canvas">
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* BANNER FLOTANTE: MODO COMBINAR / UNIR A EDIFICIO */}
        {usuarioCombinando && (
          <div className="mapa-combinar-floating-panel">
            <div className="combinar-panel-content">
              <span className="combinar-panel-icon">🏢</span>
              <div className="combinar-panel-text">
                <strong>Uniendo a #{usuarioCombinando.nroUsuario} ({usuarioCombinando.nombre})</strong>
                <span>Haz clic en el edificio o departamento en el mapa donde deseas incluirlo</span>
              </div>
            </div>
            <button
              type="button"
              className="combinar-panel-cancel-btn"
              onClick={() => {
                setUsuarioCombinando(null);
                setDestinoCombinacion(null);
              }}
            >
              ✕ Cancelar
            </button>
          </div>
        )}

        {/* PANEL FLOTANTE: MOVER PUNTO GEOLOCALIZADO (INDIVIDUAL O EDIFICIO) */}
        {(usuarioMoviendo || edificioMoviendo) && (
          <div
            className={`mover-punto-floating-panel ${edificioMoviendo ? "edificio" : ""}`}
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="mover-punto-header">
              <div className="mover-punto-title-row">
                <span className={`mover-punto-pulse-dot ${edificioMoviendo ? "edificio" : ""}`}></span>
                <span className="mover-punto-title">
                  {edificioMoviendo ? "🏢 Mover Edificio Completo" : "Mover Punto en Mapa"}
                </span>
              </div>
              <button
                type="button"
                className="mover-punto-close-btn"
                onClick={cancelarMoverPunto}
                title="Cancelar y cerrar"
              >
                ✕
              </button>
            </div>

            {edificioMoviendo ? (
              <div className="mover-punto-user-box edificio">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className="mover-punto-edificio-badge">🏢 EDIFICIO</span>
                  <strong className="mover-punto-user-name" style={{ fontSize: "14px", fontWeight: 800 }}>
                    {edificioMoviendo.nombre}
                  </strong>
                  <span className="mover-punto-deptos-count">
                    {edificioMoviendo.usuarios.length} departamentos asociados
                  </span>
                </div>
                <div className="mover-punto-edificio-sub">
                  <span>
                    📍 Al guardar, se actualizarán automáticamente las coordenadas de los {edificioMoviendo.usuarios.length} departamentos a la vez.
                  </span>
                </div>
              </div>
            ) : usuarioMoviendo ? (
              <div className="mover-punto-user-box">
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span className="mover-punto-user-nro">#{usuarioMoviendo.nroUsuario}</span>
                  <strong className="mover-punto-user-name">{usuarioMoviendo.nombre}</strong>
                </div>
                {usuarioMoviendo.domicilio && (
                  <div className="mover-punto-user-dom">
                    <span>🏠 {usuarioMoviendo.domicilio}</span>
                  </div>
                )}
              </div>
            ) : null}

            <div className="mover-punto-instructions">
              <span className="mover-punto-icon-tip">💡</span>
              <span>
                <strong>{edificioMoviendo ? "Arrastrá el marcador violeta del edificio" : "Arrastrá el marcador naranja"}</strong> o <strong>hacé clic</strong> en la ubicación exacta en el mapa.
              </span>
              <span className="mover-punto-tip-isolated">
                🎯 Los demás marcadores y rutas se ocultaron temporalmente para despejar la vista y permitir una colocación milimétrica.
              </span>
            </div>

            <div className="mover-punto-coords-inputs">
              <div className="mover-punto-field">
                <label htmlFor="input-mover-lat">Latitud</label>
                <div className="mover-punto-input-wrapper">
                  <input
                    id="input-mover-lat"
                    type="number"
                    step="any"
                    value={coordsEdicion.lat !== 0 ? coordsEdicion.lat : ""}
                    onChange={(e) => handleCoordInputChange(parseFloat(e.target.value), coordsEdicion.lng)}
                    placeholder="-34.xxxxxxx"
                    disabled={guardandoPunto}
                  />
                </div>
              </div>

              <div className="mover-punto-field">
                <label htmlFor="input-mover-lng">Longitud</label>
                <div className="mover-punto-input-wrapper">
                  <input
                    id="input-mover-lng"
                    type="number"
                    step="any"
                    value={coordsEdicion.lng !== 0 ? coordsEdicion.lng : ""}
                    onChange={(e) => handleCoordInputChange(coordsEdicion.lat, parseFloat(e.target.value))}
                    placeholder="-59.xxxxxxx"
                    disabled={guardandoPunto}
                  />
                </div>
              </div>
            </div>

            <div className="mover-punto-actions">
              <button
                type="button"
                className={`btn-guardar-punto ${edificioMoviendo ? "edificio" : ""}`}
                onClick={guardarNuevoPunto}
                disabled={guardandoPunto || isNaN(coordsEdicion.lat) || isNaN(coordsEdicion.lng)}
              >
                {guardandoPunto ? (
                  <>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span>{edificioMoviendo ? "💾 Guardar posición del edificio" : "💾 Guardar nueva posición"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-revertir-punto"
                onClick={revertirCoordsOriginales}
                disabled={guardandoPunto}
                title="Volver a las coordenadas que tenía antes de mover"
              >
                ↺ Revertir
              </button>

              <button
                type="button"
                className="btn-cancelar-punto"
                onClick={cancelarMoverPunto}
                disabled={guardandoPunto}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Overlay informativo cuando no hay ruta seleccionada o ruta inválida */}
        {!rutaActiva && (
          <div className="mapa-overlay-ruta-obligatoria">
            <div className="ruta-obligatoria-modal-card">
              <div className="ruta-modal-icon">🛣️</div>
              <h3 className="ruta-modal-title">Filtro de Ruta Obligatorio</h3>
              <p className="ruta-modal-desc">
                Para garantizar la máxima velocidad y optimizar la visualización de fraudes en Zárate, seleccioná una ruta operativa.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBuscarRuta();
                }}
                className="ruta-modal-form"
              >
                <label htmlFor="input-ruta-overlay" className="ruta-modal-label">
                  Escribí el número de ruta *:
                </label>
                <div className="ruta-modal-input-row">
                  <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                    <input
                      id="input-ruta-overlay"
                      type="text"
                      inputMode="numeric"
                      className={`ruta-input-field ${rutaError ? "error" : ""}`}
                      placeholder="Ej: 1, 23, 58, 204, 301..."
                      value={rutaEscrita}
                      onChange={(e) => handleInputRuta(e.target.value)}
                      autoFocus
                    />
                    {rutaEscrita && (
                      <button
                        type="button"
                        className="btn-limpiar-ruta"
                        onClick={() => {
                          setRutaEscrita("");
                          if (rutaError) setRutaError(null);
                        }}
                        title="Borrar texto"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn-enviar-ruta-modal"
                    disabled={cargandoRuta || !rutaEscrita.trim()}
                  >
                    {cargandoRuta ? (
                      <>
                        <span style={{ fontSize: "14px" }}>⏳</span>
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <span>Buscar Ruta</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                {rutaError && (
                  <div className="ruta-error-feedback">
                    <span className="ruta-error-icon">❌</span>
                    <span>{rutaError}</span>
                  </div>
                )}

                <div className="ruta-info-help">
                  <span>Rutas válidas:</span>
                  <strong>1 al 78</strong> • <strong>201 al 212</strong> • <strong>301, 302 y 303</strong>
                </div>

                <div className="ruta-shortcuts-pills">
                  <span style={{ fontSize: "11px", color: "#64748b", width: "100%", marginBottom: "4px" }}>
                    Rutas frecuentes en Zárate:
                  </span>
                  {["4", "6", "14", "18", "20", "23", "28", "33", "34", "38", "58", "64", "208", "302"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="ruta-chip-btn"
                      onClick={() => handleBuscarRuta(r)}
                    >
                      Ruta {r}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PANEL DE CONTROL: PLANIFICADOR DE CORTES (AUTOMÁTICO Y MANUAL) - DESPLEGABLE */}
        {mostrarPlanificadorRuta && (
          <div
            className="planner-panel"
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="planner-panel-top-bar">
              <span className="planner-panel-badge">
                <span>⚡</span> Opciones de Creación de Ruta
              </span>
              <button
                type="button"
                className="planner-panel-close-btn"
                onClick={() => {
                  setMostrarPlanificadorRuta(false);
                  setTimeout(() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.invalidateSize();
                    }
                  }, 200);
                }}
                title="Ocultar opciones de ruta"
              >
                ✕ Cerrar opciones
              </button>
            </div>

            {/* Pestañas de Modo */}
            <div className="planner-tabs-bar">
              <button
                type="button"
                className={`planner-tab-btn ${modoPlanificador === "automatico" ? "active" : ""}`}
                onClick={() => {
                  setModoPlanificador("automatico");
                }}
              >
                Ruta Automática (Por cercanía)
              </button>
              <button
                type="button"
                className={`planner-tab-btn ${modoPlanificador === "manual" ? "active" : ""}`}
                onClick={() => {
                  setModoPlanificador("manual");
                }}
              >
                Recorrido Manual (Punto por punto)
              </button>
            </div>

            <div className="planner-controls-row">
              {/* MODO 1: AUTOMÁTICO */}
              {modoPlanificador === "automatico" && (
                <div className="planner-inputs-group">
                  {/* 1. Seleccionar Fraude Inicial */}
                  <div className="planner-field">
                    <label className="planner-field-label">
                      1. Punto de Partida / Fraude Origen:
                      {filtrosEstadoKeys.length > 0 && (
                        <span style={{ color: "#2563eb", fontWeight: 700, marginLeft: "6px", textTransform: "none" }}>
                          (Filtrado por {filtrosEstadoKeys.length} {filtrosEstadoKeys.length === 1 ? "estado" : "estados"})
                        </span>
                      )}
                    </label>
                    <select
                      className="planner-select"
                      value={usuarioInicioId ?? ""}
                      onChange={(e) => setUsuarioInicioId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- Seleccionar punto inicial --</option>
                      {(filtrosEstadoKeys.length > 0 ? usuariosAMostrar : usuariosGeoreferenciados).map((u) => (
                        <option key={u.id} value={u.id}>
                          #{u.nroUsuario} - {u.nombre} ({u.estado?.nombre || "Zárate"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Cantidad de Cortes Cercanos */}
                  <div className="planner-field">
                    <label className="planner-field-label">2. Cortes Más Cercanos (N):</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, (filtrosEstadoKeys.length > 0 ? usuariosAMostrar : usuariosGeoreferenciados).length)}
                      className="planner-number-input"
                      style={{ width: "110px", textAlign: "left", paddingLeft: "12px" }}
                      placeholder="Ej: 5"
                      value={cantidadCortes}
                      onChange={(e) => setCantidadCortes(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    />
                  </div>

                  {/* Botón Calcular */}
                  <div style={{ alignSelf: "flex-end" }}>
                    <button
                      type="button"
                      className="planner-btn-calc"
                      onClick={handleCalcularRuta}
                      disabled={!usuarioInicioId}
                    >
                      <span>
                        Calcular Ruta Óptima
                        {filtrosEstadoKeys.length > 0 ? ` (${usuariosAMostrar.length} disponibles)` : ""}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODO 2: RECORRIDO MANUAL */}
              {modoPlanificador === "manual" && (
                <div className="manual-route-builder">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "280px" }}>
                      <label className="planner-field-label" style={{ whiteSpace: "nowrap" }}>
                        Sumar fraude al recorrido:
                      </label>
                      <select
                        className="planner-select"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const u = usuarios.find((user) => user.id === Number(e.target.value));
                          if (u) agregarParadaManual(u);
                        }}
                      >
                        <option value="">-- Seleccionar fraude para agregar --</option>
                        {usuariosGeoreferenciados.map((u) => {
                          const yaEnRuta = paradasManuales.some((p) => p.id === u.id);
                          return (
                            <option key={u.id} value={u.id} disabled={yaEnRuta}>
                              #{u.nroUsuario} - {u.nombre} {yaEnRuta ? "(Ya en ruta)" : `(${u.domicilio || "Zárate"})`}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Switch de Click Directo en el Mapa */}
                    <label className="manual-toggle-wrap" title="Si está activo, al hacer click en cualquier marcador del mapa se suma o quita directamente de la ruta manual">
                      <input
                        type="checkbox"
                        checked={clickDirectoManual}
                        onChange={(e) => setClickDirectoManual(e.target.checked)}
                        className="manual-toggle-input"
                      />
                      <span>Click directo en el mapa para marcar paradas</span>
                    </label>
                  </div>

                  {/* Barra de herramientas y resumen si hay paradas */}
                  {paradasManuales.length > 0 && (
                    <div className="manual-tools-bar">
                      <div style={{ fontSize: "12px", color: "#334155", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>Paradas seleccionadas:</span>
                        <strong style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "12px" }}>
                          {paradasManuales.length}
                        </strong>
                      </div>

                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="manual-tool-btn"
                          onClick={handleOptimizarOrdenManual}
                          title="Reordenar las paradas seleccionadas por mínima distancia (algoritmo de cercanía)"
                        >
                          <span>Optimizar orden</span>
                        </button>
                        <button
                          type="button"
                          className="manual-tool-btn"
                          onClick={handleInvertirOrdenManual}
                          title="Invertir la dirección del recorrido"
                        >
                          <span>Invertir</span>
                        </button>
                        <button
                          type="button"
                          className="manual-tool-btn danger"
                          onClick={handleLimpiarRuta}
                          title="Quitar todas las paradas y limpiar el mapa"
                        >
                          <span>Limpiar paradas</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista secuencial de paradas manuales */}
                  {paradasManuales.length > 0 ? (
                    <div className="manual-stops-list">
                      {paradasManuales.map((u, idx) => (
                        <div key={u.id} className={`manual-stop-chip ${idx === 0 ? "first" : ""}`}>
                          <span className="manual-stop-badge">
                            {idx === 0 ? "1. Inicio" : `${idx + 1}. Parada`}
                          </span>
                          <span style={{ fontWeight: 600 }}>#{u.nroUsuario}</span>
                          <span style={{ color: "#64748b", fontSize: "11px" }}>{u.nombre}</span>
                          <div className="manual-stop-actions">
                            <button
                              type="button"
                              className="manual-stop-reorder-btn"
                              onClick={() => moverParadaIndex(idx, -1)}
                              disabled={idx === 0}
                              title="Mover antes en la secuencia"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="manual-stop-reorder-btn"
                              onClick={() => moverParadaIndex(idx, 1)}
                              disabled={idx === paradasManuales.length - 1}
                              title="Mover después en la secuencia"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="manual-stop-remove"
                              onClick={() => removerParadaManual(u.id)}
                              title="Quitar esta parada de la secuencia"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", fontSize: "12px", color: "#64748b" }}>
                      Haz click directamente en los marcadores del mapa o seleccionalos en el menú desplegable para ir armando el recorrido punto por punto en el orden deseado.
                    </div>
                  )}
                </div>
              )}

              {/* Acciones si hay ruta calculada */}
              {resultadoRuta && (
                <div className="planner-actions-group">
                  <button
                    type="button"
                    className="btn-export-excel"
                    onClick={handleDescargarExcel}
                    title="Descargar planilla Excel con la ruta de cortes y el padrón de fraudes"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Descargar Excel (Ruta + Padrón)</span>
                  </button>

                  <a
                    href={generarUrlGoogleMapsRuta(resultadoRuta.paradas)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-nav-gmaps"
                    title="Abrir la ruta secuencial en Google Maps Navigation"
                  >
                    <span>Abrir en Google Maps</span>
                  </a>

                  <button
                    type="button"
                    className="btn-clear-route"
                    onClick={handleLimpiarRuta}
                    title="Quitar trazado de ruta del mapa"
                  >
                    ✕ Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* Resumen de la Ruta Calculada */}
            {resultadoRuta && (
              <div className="route-summary-banner">
                <div className="route-summary-stats">
                  <div className="route-stat-item">
                    <span>Cortes planificados:</span>
                    <strong>{resultadoRuta.paradas.length}</strong>
                  </div>
                  <div className="route-stat-item">
                    <span>Distancia total en calles:</span>
                    <strong>{resultadoRuta.distanciaTotalFormateada}</strong>
                  </div>
                  <div className="route-stat-item">
                    <span>Tiempo estimado de operativo:</span>
                    <strong>~{resultadoRuta.tiempoEstimadoMinutos} min</strong>
                  </div>
                  <div className="route-stat-item">
                    <span>Trazado vial:</span>
                    <strong style={{ color: resultadoRuta.esRutaPorCalles ? "#059669" : "#0284c7" }}>
                      {resultadoRuta.esRutaPorCalles ? "Por calles de Zárate (ajustado a calzada)" : "Calculando calles..."}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Asignación Masiva de Cuadrillas a la Ruta Completa */}
            {resultadoRuta && (
              <div className="route-cuadrillas-assignment-card">
                <div className="route-cuadrillas-header">
                  <div>
                    <h4 className="route-cuadrillas-title">
                      Asignar Cuadrillas a los {resultadoRuta.paradas.length} Cortes de la Ruta
                    </h4>
                    <p className="route-cuadrillas-desc">
                      Selecciona una o más cuadrillas. Se asignarán a todos los usuarios de este recorrido, reemplazando su asignación anterior.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-apply-cuadrillas"
                    onClick={handleAsignarCuadrillasRuta}
                    disabled={asignandoCuadrillas || cuadrillasSeleccionadasRuta.length === 0}
                  >
                    {asignandoCuadrillas ? "Asignando cuadrillas..." : "Guardar Asignación para toda la Ruta"}
                  </button>
                </div>

                <div className="route-cuadrillas-chips">
                  {cuadrillasDisponibles.map((c) => {
                    const isSelected = cuadrillasSeleccionadasRuta.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCuadrillaRuta(c.id)}
                        className={`chip-cuadrilla-select ${isSelected ? "selected" : ""}`}
                      >
                        <span>{isSelected ? "✓" : "+"}</span>
                        <span>{c.nombre}</span>
                      </button>
                    );
                  })}
                  {cuadrillasDisponibles.length === 0 && (
                    <span style={{ fontSize: "12.5px", color: "#94a3b8" }}>
                      No hay cuadrillas registradas en el sistema.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}




        {/* Ayuda Memoria a la derecha del mapa con filtros interactivos */}
        <div className={`mapa-ayuda-memoria-panel ${ayudaMemoriaAbierto ? "open" : "collapsed"}`}>
          {ayudaMemoriaAbierto ? (
            <>
              <div className="ayuda-memoria-header">
                <h4 className="ayuda-memoria-title">
                  Ayuda Memoria: Estados {rutaActiva ? `(Ruta ${rutaActiva})` : ""}
                </h4>
                <button
                  type="button"
                  className="ayuda-memoria-toggle-btn"
                  onClick={() => setAyudaMemoriaAbierto(false)}
                  title="Minimizar ayuda memoria"
                >
                  ✕
                </button>
              </div>

              <div className="ayuda-memoria-content">
                {!rutaActiva ? (
                  <div style={{ padding: "26px 14px", textAlign: "center", color: "#64748b", fontSize: "12.5px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🛣️</div>
                    <strong style={{ display: "block", color: "#334155", marginBottom: "6px" }}>
                      Filtro de Ruta Obligatorio
                    </strong>
                    <span>Ingresá un número de ruta para ver el resumen de fraudes y activar los filtros por estado.</span>
                  </div>
                ) : (
                  <>
                    {/* Selector de Tipo de Inmueble (Departamentos vs Independientes) arriba de todo */}
                    <div className="filtro-tipo-inmueble-container">
                      <div className="filtro-tipo-inmueble-label">
                        <span>🏢 Tipo de Inmueble:</span>
                        {filtroTipoInmueble !== "todos" && (
                          <button
                            type="button"
                            className="filtro-inmueble-reset-link"
                            onClick={() => setFiltroTipoInmueble("todos")}
                          >
                            Ver todos
                          </button>
                        )}
                      </div>
                      <div className="filtro-tipo-inmueble-pills">
                        <button
                          type="button"
                          className={`filtro-inmueble-pill ${filtroTipoInmueble === "todos" ? "active" : ""}`}
                          onClick={() => setFiltroTipoInmueble("todos")}
                          title="Mostrar todos los usuarios y edificios"
                        >
                          <span className="pill-icon">🌐</span>
                          <span className="pill-text">Todos</span>
                          <span className="pill-badge">{usuariosGeoreferenciados.length}</span>
                        </button>
                        <button
                          type="button"
                          className={`filtro-inmueble-pill ${filtroTipoInmueble === "departamentos" ? "active" : ""}`}
                          onClick={() =>
                            setFiltroTipoInmueble((prev) =>
                              prev === "departamentos" ? "todos" : "departamentos"
                            )
                          }
                          title="Filtrar únicamente edificios y departamentos"
                        >
                          <span className="pill-icon">🏢</span>
                          <span className="pill-text">Deptos</span>
                          <span className="pill-badge">{conteoDepartamentos}</span>
                        </button>
                        <button
                          type="button"
                          className={`filtro-inmueble-pill ${filtroTipoInmueble === "independientes" ? "active" : ""}`}
                          onClick={() =>
                            setFiltroTipoInmueble((prev) =>
                              prev === "independientes" ? "todos" : "independientes"
                            )
                          }
                          title="Filtrar únicamente inmuebles y puntos independientes"
                        >
                          <span className="pill-icon">🏠</span>
                          <span className="pill-text">Indep.</span>
                          <span className="pill-badge">{conteoIndependientes}</span>
                        </button>
                      </div>
                    </div>

                    {/* Banner de filtros activos */}
                    {filtrosEstadoKeys.length > 0 || filtroTipoInmueble !== "todos" ? (
                      <div className="ayuda-memoria-banner-active">
                        <span className="ayuda-memoria-banner-text">
                          <span>
                            {filtroTipoInmueble !== "todos"
                              ? filtroTipoInmueble === "departamentos"
                                ? "🏢 Deptos"
                                : "🏠 Indep."
                              : "Filtros activos"}
                            {filtrosEstadoKeys.length > 0 ? ` (${filtrosEstadoKeys.length})` : ""}:
                          </span>
                          <strong>
                            {usuariosAMostrar.length} fraudes
                          </strong>
                        </span>
                        <button
                          type="button"
                          className="ayuda-memoria-clear-btn"
                          onClick={limpiarTodosLosFiltros}
                          title="Quitar todos los filtros y ver todos los puntos"
                        >
                          Ver todos
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", padding: "0 2px" }}>
                        Filtrar por estados en Ruta {rutaActiva}:
                      </div>
                    )}

                    {/* Botón Ver Todos */}
                    <button
                      type="button"
                      className={`ayuda-memoria-item ${filtrosEstadoKeys.length === 0 ? "active" : ""}`}
                      onClick={limpiarTodosLosFiltros}
                      style={{
                        borderColor: filtrosEstadoKeys.length === 0 ? "#2563eb" : "#e2e8f0",
                        background: filtrosEstadoKeys.length === 0 ? "#eff6ff" : "#ffffff",
                        borderWidth: filtrosEstadoKeys.length === 0 ? "2px" : "1.5px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "12px" }}>🌐</span>
                        <span
                          className="ayuda-memoria-item-name"
                          style={{ color: filtrosEstadoKeys.length === 0 ? "#1d4ed8" : "#1e293b", fontWeight: 700 }}
                        >
                          Todos los estados
                        </span>
                      </div>
                      <span className="ayuda-memoria-count">
                        {usuariosGeoreferenciados.length}
                      </span>
                    </button>

                    {/* Lista de estados con su color correspondiente (multi-selección) */}
                    {ESTADOS_MAPA_CONFIG.map((est) => {
                      const count = conteoPorEstado[est.key] || 0;
                      const isSelected = filtrosEstadoKeys.includes(est.key);

                      return (
                        <button
                          key={est.key}
                          type="button"
                          className={`ayuda-memoria-item ${isSelected ? "active" : ""}`}
                          onClick={() => toggleFiltroEstado(est.key)}
                          style={{
                            borderColor: isSelected ? est.border : "#e2e8f0",
                            background: isSelected ? est.badgeBg : "#ffffff",
                            borderWidth: isSelected ? "2px" : "1.5px",
                          }}
                          title={`${isSelected ? "Desactivar" : "Activar"} filtro por ${est.nombre} (${count} fraudes)`}
                        >
                          <div className="ayuda-memoria-item-info">
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "14px",
                                  height: "14px",
                                  borderRadius: "4px",
                                  border: isSelected ? `1.5px solid ${est.border}` : "1.5px solid #cbd5e1",
                                  background: isSelected ? est.bg : "#ffffff",
                                  color: isSelected ? est.text : "transparent",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  lineHeight: 1,
                                }}
                              >
                                ✓
                              </span>
                              <span
                                className="ayuda-memoria-color-badge"
                                style={{ backgroundColor: est.bg, border: `1px solid ${est.border}` }}
                              />
                            </div>
                            <span
                              className="ayuda-memoria-item-name"
                              style={{
                                color: isSelected ? est.badgeText : "#1e293b",
                                fontWeight: isSelected ? 800 : 600,
                              }}
                            >
                              {est.emoji ? `${est.emoji} ` : ""}{est.nombre}
                            </span>
                            <span
                              className="ayuda-memoria-item-tag"
                              style={{
                                background: est.badgeBg,
                                color: est.badgeText,
                                border: `1px solid ${est.border}44`,
                              }}
                            >
                              {est.colorName}
                            </span>
                          </div>
                          <span
                            className="ayuda-memoria-count"
                            style={{
                              background: isSelected ? est.bg : "#f1f5f9",
                              color: isSelected ? est.text : "#475569",
                            }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              className="ayuda-memoria-floating-btn"
              onClick={() => setAyudaMemoriaAbierto(true)}
              title="Abrir Ayuda Memoria y Filtros por Estado"
            >
              <span>Ayuda Memoria</span>
              {filtrosEstadoKeys.length > 0 && (
                <span
                  style={{
                    background: "#38bdf8",
                    color: "#0f172a",
                    borderRadius: "10px",
                    padding: "1px 6px",
                    fontSize: "10px",
                    fontWeight: 800,
                  }}
                >
                  {filtrosEstadoKeys.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pie y leyenda */}
      <div className="mapa-general-footer">
        <div className="map-legend">
          <div className="legend-item">
            <span>Pines con código de color según estado (Ver Ayuda Memoria a la derecha)</span>
          </div>
          {resultadoRuta && (
            <>
              <div className="legend-item">
                <span className="legend-bullet" style={{ background: "#059669" }}></span>
                <span>Marcador verde: Punto de inicio del operativo</span>
              </div>
              <div className="legend-item">
                <span className="legend-bullet" style={{ background: "#0284c7" }}></span>
                <span>Marcadores azules: Secuencia de cortes</span>
              </div>
              <div className="legend-item">
                <span className="legend-bullet" style={{ background: "#2563eb", width: "16px", height: "4px", borderRadius: "2px" }}></span>
                <span>Línea azul: Recorrido vehicular por calles de Zárate</span>
              </div>
            </>
          )}
          <div className="legend-item">
            <span>🏙️ Cobertura: Zárate, Buenos Aires</span>
          </div>
        </div>

        <div>
          <span>
            {usuarios.length - usuariosGeoreferenciados.length > 0
              ? `${usuarios.length - usuariosGeoreferenciados.length} usuarios sin coordenadas`
              : "Todos los usuarios geolocalizados"}
          </span>
        </div>
      </div>

      {/* Modal con listado de usuarios no encontrados en Maps */}
      {showModalSinGeo && (
        <div className="popup-overlay">
          <div className="popup-content modal-sin-geo-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-simple">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontSize: "24px" }}>⚠️</div>
                <div>
                  <h3 className="modal-simple-title">
                    Usuarios Sin Ubicación en Maps (Ruta {rutaActiva})
                  </h3>
                  <p className="modal-simple-subtitle">
                    Hay {usuariosSinGeo.length} usuarios en esta ruta que no poseen coordenadas geográficas asignadas.
                  </p>
                </div>
              </div>
              <button
                className="modal-close-icon"
                onClick={() => setShowModalSinGeo(false)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="sin-geo-list-container">
              {usuariosSinGeo.map((u) => (
                <div key={u.id} className="sin-geo-item-card">
                  <div className="sin-geo-item-info">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className="badge-user-nro" style={{ background: "#e2e8f0", color: "#1e293b", padding: "2px 7px", borderRadius: "5px", fontFamily: "JetBrains Mono", fontSize: "11.5px", fontWeight: 800 }}>
                        #{u.nroUsuario}
                      </span>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>{u.nombre}</strong>
                      {u.estado && (
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#f1f5f9", color: "#334155" }}>
                          {u.estado.nombre}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "12px", color: "#64748b", flexWrap: "wrap" }}>
                      <span><strong>Domicilio:</strong> {u.domicilio || "— Sin domicilio"}</span>
                      {u.medidor && <span><strong>Medidor:</strong> {u.medidor}</span>}
                    </div>
                  </div>
                  <span className="alerta-sin-maps-badge">
                    ⚠️ No encontrado en Maps
                  </span>
                </div>
              ))}
            </div>

            <div className="modal-actions-simple" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => setShowModalSinGeo(false)}
              >
                Cerrar Lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para combinar e incluir en edificio (Portal directo al document.body para pantalla grande enfrente de todo) */}
      {mounted &&
        typeof document !== "undefined" &&
        destinoCombinacion &&
        createPortal(
          <div className="modal-combinar-overlay">
            <div className="modal-combinar-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-combinar-header">
                <div className="modal-combinar-title-group">
                  <span className="modal-combinar-title-icon">🏢</span>
                  <div>
                    <h3 className="modal-combinar-title">Combinar e Incluir en Edificio</h3>
                    <p className="modal-combinar-subtitle">
                      Se unificarán las coordenadas para agruparlos en un único marcador con lista desplegable
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close-icon"
                  onClick={() => !guardandoCombinacion && setDestinoCombinacion(null)}
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>

              <div className="modal-combinar-boxes-container">
                {usuarioCombinando ? (
                  <div className="modal-combinar-box origen">
                    <span className="modal-combinar-box-label">📍 Usuario / Punto a Incorporar</span>
                    <span className="modal-combinar-box-title">
                      #{usuarioCombinando.nroUsuario} — {usuarioCombinando.nombre}
                    </span>
                    <span className="modal-combinar-box-sub">
                      {usuarioCombinando.domicilio || "Sin domicilio registrado"}
                    </span>
                  </div>
                ) : (
                  <div className="modal-combinar-box origen">
                    <span className="modal-combinar-box-label">📍 Usuario a Incorporar</span>
                    <span className="modal-combinar-box-sub">
                      Haz clic en un punto del mapa para seleccionarlo
                    </span>
                  </div>
                )}

                <div className="modal-combinar-arrow">⬇️ Se unirá al edificio / departamento de</div>

                <div className="modal-combinar-box destino">
                  <span className="modal-combinar-box-label">
                    {destinoCombinacion.esEdificio ? "🏢 Edificio de Destino" : "🏢 Departamento / Ubicación de Destino"}
                  </span>
                  <span className="modal-combinar-box-title">
                    {destinoCombinacion.domicilio || "Ubicación en Zárate"}
                  </span>
                  <span className="modal-combinar-box-sub">
                    Coordenadas: {destinoCombinacion.lat.toFixed(6)}, {destinoCombinacion.lng.toFixed(6)}
                    {destinoCombinacion.usuarios && destinoCombinacion.usuarios.length > 0
                      ? ` (${destinoCombinacion.usuarios.length} usuario(s) actuales)`
                      : ""}
                  </span>
                </div>
              </div>

              <div className="modal-combinar-input-group">
                <label className="modal-combinar-input-label">
                  Piso / Depto o Domicilio específico (opcional):
                </label>
                <input
                  type="text"
                  className="modal-combinar-input"
                  placeholder="Ej: Piso 2 Depto B (o dejar vacío)"
                  value={pisoDeptoInput}
                  onChange={(e) => setPisoDeptoInput(e.target.value)}
                  disabled={guardandoCombinacion}
                />
              </div>

              <div className="modal-combinar-actions">
                <button
                  type="button"
                  className="modal-btn-cancelar"
                  onClick={() => {
                    setDestinoCombinacion(null);
                    setUsuarioCombinando(null);
                  }}
                  disabled={guardandoCombinacion}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="modal-btn-confirmar-combinar"
                  onClick={handleConfirmarCombinacion}
                  disabled={guardandoCombinacion || !usuarioCombinando}
                >
                  {guardandoCombinacion ? "Guardando..." : "🏢 Confirmar y Unir"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL DE CONFIRMACIÓN: SEPARAR USUARIO DE EDIFICIO */}
      {mounted && usuarioSeparando && createPortal(
        <div
          className="modal-combinar-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !separandoEdificio) {
              setUsuarioSeparando(null);
            }
          }}
        >
          <div
            className="modal-combinar-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="modal-combinar-header">
              <div className="modal-combinar-title-group">
                <span className="modal-combinar-title-icon" style={{ background: "#fef3c7", borderColor: "#fde68a" }}>
                  ✂️
                </span>
                <div>
                  <h4 className="modal-combinar-title">Separar Usuario del Edificio</h4>
                  <p className="modal-combinar-subtitle">
                    Convertir en punto individual e independiente
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={() => !separandoEdificio && setUsuarioSeparando(null)}
                disabled={separandoEdificio}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="modal-combinar-boxes-container">
              <div className="modal-combinar-box origen" style={{ borderLeftColor: "#f59e0b" }}>
                <span className="modal-combinar-box-label">Usuario a Desvincular</span>
                <span className="modal-combinar-box-title">
                  #{usuarioSeparando.nroUsuario} — {usuarioSeparando.nombre}
                </span>
                <span className="modal-combinar-box-sub">
                  {usuarioSeparando.domicilio ? `📍 Domicilio actual: ${usuarioSeparando.domicilio}` : "Sin domicilio específico"}
                </span>
              </div>

              <div style={{ padding: "10px 14px", background: "#fffbeb", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "12px", color: "#92400e", lineHeight: "1.45" }}>
                ℹ️ Al separar a este usuario, dejará de agruparse dentro del edificio. Pasará a tener su propio marcador individual en el mapa.
              </div>
            </div>

            <div className="modal-combinar-actions" style={{ flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                className="modal-btn-cancelar"
                onClick={() => setUsuarioSeparando(null)}
                disabled={separandoEdificio}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="modal-btn-cancelar"
                style={{ background: "#f8fafc", color: "#1e293b", fontWeight: 700 }}
                onClick={() => handleConfirmarSeparacion(false)}
                disabled={separandoEdificio}
                title="Separar y mantener en sus coordenadas actuales"
              >
                {separandoEdificio ? "Separando..." : "✂️ Separar aquí"}
              </button>
              <button
                type="button"
                className="modal-btn-confirmar-combinar"
                style={{ background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", boxShadow: "0 4px 12px rgba(217, 119, 6, 0.35)" }}
                onClick={() => handleConfirmarSeparacion(true)}
                disabled={separandoEdificio}
                title="Separar y activar el modo mover para colocarlo en otra ubicación"
              >
                {separandoEdificio ? "Separando..." : "📍 Separar y Mover en Mapa"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Lightbox para ver fotografía ampliada en el mapa */}
      {mounted &&
        typeof document !== "undefined" &&
        fotoFullscreen &&
        createPortal(
          <div
            className="modal-foto-mapa-overlay"
            onClick={() => setFotoFullscreen(null)}
          >
            <div
              className="modal-foto-mapa-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-foto-mapa-header">
                <div className="modal-foto-mapa-title">
                  <span>📸</span>
                  <span>Fotografía del Usuario / Suministro</span>
                </div>
                <button
                  type="button"
                  className="modal-foto-mapa-close"
                  onClick={() => setFotoFullscreen(null)}
                  title="Cerrar (Esc)"
                >
                  ✕
                </button>
              </div>

              <div className="modal-foto-mapa-body">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getValidImageUrl(fotoFullscreen)}
                  alt="Fotografía inspección"
                  className="modal-foto-mapa-img"
                />
              </div>

              <div className="modal-foto-mapa-footer">
                <a
                  href={getValidImageUrl(fotoFullscreen)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-foto-btn-action"
                  title="Abrir imagen en pestaña nueva"
                >
                  <span>Abrir en pestaña nueva ↗</span>
                </a>
                <button
                  type="button"
                  className="modal-foto-btn-action"
                  style={{ background: "#0284c7", borderColor: "#0369a1", color: "#ffffff" }}
                  onClick={() => setFotoFullscreen(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
