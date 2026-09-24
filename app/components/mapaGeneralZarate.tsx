"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
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
import { toast } from "react-toastify";

const ZARATE_CENTER: [number, number] = [-34.0964, -59.0289];
const DEFAULT_ZOOM = 13;

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

  const [usuarios, setUsuarios] = useState<UsuarioGeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");

  // Estado de Pantalla Completa
  const [esPantallaCompleta, setEsPantallaCompleta] = useState<boolean>(false);

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
  const [ayudaMemoriaAbierto, setAyudaMemoriaAbierto] = useState<boolean>(true);

  // Alternar filtro individual (permite múltiples filtros simultáneos)
  const toggleFiltroEstado = (key: string) => {
    setFiltrosEstadoKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const limpiarTodosLosFiltros = () => {
    setFiltrosEstadoKeys([]);
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

  // Cargar usuarios y cuadrillas desde la API
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const [resUsers, resCuadrillas] = await Promise.all([
        fetch("/api/usuariosapi"),
        fetch("/api/cuadrillasapi"),
      ]);

      if (resUsers.ok) {
        const data = await resUsers.json();
        setUsuarios(data);
      }
      if (resCuadrillas.ok) {
        const dataC = await resCuadrillas.json();
        setCuadrillasDisponibles(dataC);
      }
    } catch (err) {
      console.error("Error al cargar datos para el mapa:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, [refreshKey]);

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

    return () => {
      delete (window as any).fijarUsuarioInicioCorte;
      delete (window as any).toggleParadaManual;
      delete (window as any).moverParadaManual;
    };
  }, [usuarios]);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      LRef.current = L;

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: ZARATE_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
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
      window.removeEventListener("resize", () => {});
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
      }
    };
  }, []);

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
    const boundsPoints: [number, number][] = [];

    usuariosAMostrar.forEach((user) => {
      // Si el usuario ya está dibujado en la ruta de cortes (azul/verde),
      // no dibujamos el marcador de estado para evitar que queden superpuestos uno encima del otro.
      if (idsEnRuta.has(user.id)) {
        return;
      }

      const lat = Number(user.latitud);
      const lng = Number(user.longitud);
      boundsPoints.push([lat, lng]);

      const config = obtenerConfigEstadoPorUsuario(user.estado);
      const isFiltrado = filtrosEstadoKeys.length > 0;

      const pinHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35)); transition: transform 0.2s ease;" class="custom-user-pin ${config.key}">
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
          ">
            ${config.emoji ? `<span style="font-size: 11px;">${config.emoji}</span>` : ""}
            <span>#${user.nroUsuario}</span>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 7px solid ${config.bg};
            margin-top: -1px;
            transform: ${isFiltrado ? "scale(1.1)" : "scale(1)"};
          "></div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: "custom-user-marker",
        html: pinHtml,
        iconSize: [85, 34],
        iconAnchor: [42, 32],
        popupAnchor: [0, -32],
      });

      const infoVto = obtenerInfoVencimiento(user.fechaVto);

      const popupHtml = `
        <div class="custom-map-popup">
          <div class="popup-user-header">
            <span class="popup-user-badge" style="background: ${config.bg}; color: ${config.text}; border: 1px solid ${config.border}; font-weight: 800;">
              #${user.nroUsuario}
            </span>
            ${
              user.estado
                ? `<span class="popup-estado-badge" style="background: ${config.badgeBg}; color: ${config.badgeText}; border: 1px solid ${config.border}; font-weight: 800;">
                    ${config.emoji ? `${config.emoji} ` : ""}${user.estado.nombre}
                  </span>`
                : ""
            }
          </div>
          <h4 class="popup-user-name">${user.nombre}</h4>
          ${
            (user.esDepartamento || user.idEstadoDepto || user.estadoDepto)
              ? `<div class="popup-user-info-row" style="margin-bottom: 4px;">
                  <span style="display: inline-flex; align-items: center; gap: 4px; background: #ede9fe; color: #5b21b6; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #ddd6fe;">
                    🏢 Depto: ${user.estadoDepto?.nombre || "Asignado"}
                  </span>
                </div>`
              : ""
          }
          ${
            user.domicilio
              ? `<div class="popup-user-info-row">
                  <span><strong>Domicilio:</strong> ${user.domicilio}</span>
                </div>`
              : ""
          }
          ${
            user.medidor
              ? `<div class="popup-user-info-row">
                  <span><strong>Medidor:</strong> ${user.medidor}</span>
                </div>`
              : ""
          }
          ${
            user.ruta
              ? `<div class="popup-user-info-row">
                  <span><strong>Ruta:</strong> ${user.ruta}</span>
                </div>`
              : ""
          }
          <div class="popup-user-info-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
            <span><strong>Vto:</strong> <span style="color: #dc2626; font-weight: 700;">${infoVto.texto}</span></span>
          </div>
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

      const marker = L.marker([lat, lng], { icon: userIcon });

      marker.on("click", (e: any) => {
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

      markersLayerRef.current.addLayer(marker);
      userMarkersMap.current.set(user.id, marker);
    });

    // La pantalla y el mapa se mantienen estáticos sin saltos de cámara
  }, [usuarios, resultadoRuta, filtrosEstadoKeys, mapReady]);

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
          ${
            usuario.domicilio
              ? `<div class="popup-user-info-row">
                  <span><strong>Domicilio:</strong> ${usuario.domicilio}</span>
                </div>`
              : ""
          }
          ${
            usuario.medidor
              ? `<div class="popup-user-info-row">
                  <span><strong>Medidor:</strong> ${usuario.medidor}</span>
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
            <div style="display: flex; gap: 4px; align-items: center;">
              <button
                type="button"
                onclick="window.toggleParadaManual(${usuario.id})"
                class="popup-btn-add-manual remove"
                title="Quitar esta parada de la ruta"
              >
                Quitar
              </button>
              ${
                orden > 1
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
              ${
                orden < res.paradas.length
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

  // Manejar el enfoque sobre un usuario buscado
  const handleFocusUsuario = (usuarioId: number) => {
    const marker = userMarkersMap.current.get(usuarioId);
    if (marker && mapInstanceRef.current) {
      const latlng = marker.getLatLng();
      mapInstanceRef.current.flyTo(latlng, 17, { duration: 1.2 });
      setTimeout(() => {
        marker.openPopup();
      }, 1250);
    }
  };

  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(ZARATE_CENTER, DEFAULT_ZOOM, { duration: 1 });
    }
  };

  const usuariosGeoreferenciados = usuarios.filter(
    (u) =>
      u.latitud !== null &&
      u.longitud !== null &&
      !isNaN(Number(u.latitud)) &&
      !isNaN(Number(u.longitud))
  );

  // Usuarios filtrados por estados activos (o todos si no hay ninguno seleccionado)
  const usuariosAMostrar = useMemo(() => {
    return usuariosGeoreferenciados.filter((u) => {
      if (filtrosEstadoKeys.length === 0) return true;
      const c = obtenerConfigEstadoPorUsuario(u.estado);
      return filtrosEstadoKeys.includes(c.key);
    });
  }, [usuariosGeoreferenciados, filtrosEstadoKeys]);

  // Conteo de usuarios por cada estado
  const conteoPorEstado = useMemo(() => {
    const mapaConteos: Record<string, number> = {};
    usuariosGeoreferenciados.forEach((u) => {
      const config = obtenerConfigEstadoPorUsuario(u.estado);
      mapaConteos[config.key] = (mapaConteos[config.key] || 0) + 1;
    });
    return mapaConteos;
  }, [usuariosGeoreferenciados]);

  // Lista de configuraciones de los estados actualmente filtrados
  const configsFiltrosActivos = useMemo(() => {
    return ESTADOS_MAPA_CONFIG.filter((e) => filtrosEstadoKeys.includes(e.key));
  }, [filtrosEstadoKeys]);

  const usuariosFiltrados = usuariosGeoreferenciados.filter((u) => {
    if (!searchFilter.trim()) return false;
    const term = searchFilter.toLowerCase();
    return (
      u.nroUsuario.toLowerCase().includes(term) ||
      u.nombre.toLowerCase().includes(term) ||
      (u.domicilio && u.domicilio.toLowerCase().includes(term))
    );
  });

  return (
    <div
      ref={cardContainerRef}
      className={`mapa-general-card ${esPantallaCompleta ? "fullscreen-mode" : ""}`}
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
          <div className="mapa-stats-pill">
            <span>Fraudes Geolocalizados:</span>
            <strong>{usuariosGeoreferenciados.length}</strong>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Buscar por N° o nombre en el mapa..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="mapa-filter-input"
            />
            {usuariosFiltrados.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: "6px",
                  background: "#ffffff",
                  borderRadius: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                  zIndex: 2000,
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                }}
              >
                {usuariosFiltrados.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      handleFocusUsuario(u.id);
                      setSearchFilter("");
                    }}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                      color: "#1e293b",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#eff6ff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <span>
                      <strong style={{ fontFamily: "JetBrains Mono" }}>
                        #{u.nroUsuario}
                      </strong>{" "}
                      - {u.nombre}
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      📍 Ver en mapa
                    </span>
                  </div>
                ))}
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

          <button
            type="button"
            className="btn-map-action"
            onClick={fetchUsuarios}
            disabled={loading}
            style={{ padding: "7px 12px", borderRadius: "8px" }}
          >
            🔄 {loading ? "Cargando..." : "Actualizar"}
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
                  Ayuda Memoria: Estados
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
                {/* Banner de filtros activos */}
                {filtrosEstadoKeys.length > 0 ? (
                  <div className="ayuda-memoria-banner-active">
                    <span className="ayuda-memoria-banner-text">
                      <span>Filtros activos ({filtrosEstadoKeys.length}):</span>
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
                    Selecciona uno o más estados para filtrar el mapa y la ruta:
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
    </div>
  );
}
