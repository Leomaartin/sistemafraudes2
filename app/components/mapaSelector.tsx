"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "../css/mapa.css";
import {
  dmsToDecimal,
  decimalToDms,
  formatearDmsCompleto,
  parsearCoordenadas,
} from "@/lib/coordenadasUtils";

// Coordenadas centrales de Zárate, Buenos Aires
const ZARATE_CENTER: [number, number] = [-34.0964, -59.0289];
const DEFAULT_ZOOM = 14;

interface MapaSelectorProps {
  latitud: number | null;
  longitud: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  domicilioSugerido?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function MapaSelector({
  latitud,
  longitud,
  onChange,
  domicilioSugerido = "",
}: MapaSelectorProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // Estados para búsqueda por texto en OpenStreetMap
  const [searchQuery, setSearchQuery] = useState(domicilioSugerido);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Estados para el Menú Desplegable "Marcar dirección exacta"
  const [mostrarMenuExacto, setMostrarMenuExacto] = useState(false);
  const [modoCarga, setModoCarga] = useState<"pegado" | "dms" | "decimal">("pegado");

  // Modo 1: Pegado / Detección inteligente
  const [textoPegado, setTextoPegado] = useState("");

  // Modo 2: Grados, Minutos y Segundos (GMS / DMS)
  const [dmsLatG, setDmsLatG] = useState<string>("34");
  const [dmsLatM, setDmsLatM] = useState<string>("05");
  const [dmsLatS, setDmsLatS] = useState<string>("22.6");
  const [dmsLatDir, setDmsLatDir] = useState<"S" | "N">("S");

  const [dmsLngG, setDmsLngG] = useState<string>("59");
  const [dmsLngM, setDmsLngM] = useState<string>("01");
  const [dmsLngS, setDmsLngS] = useState<string>("56.3");
  const [dmsLngDir, setDmsLngDir] = useState<"W" | "O" | "E">("W");

  // Modo 3: Decimal Directo
  const [decLat, setDecLat] = useState<string>("");
  const [decLng, setDecLng] = useState<string>("");

  // Feedback y copiado
  const [feedback, setFeedback] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const [copiadoDms, setCopiadoDms] = useState(false);

  // Sincronizar búsqueda cuando cambia el domicilio sugerido del formulario
  useEffect(() => {
    if (domicilioSugerido && !searchQuery) {
      setSearchQuery(domicilioSugerido);
    }
  }, [domicilioSugerido]);

  // Sincronizar los campos de coordenadas cuando cambian externamente (o al hacer click/drag)
  useEffect(() => {
    if (latitud !== null && longitud !== null) {
      // Sincronizar decimal
      setDecLat(latitud.toString());
      setDecLng(longitud.toString());

      // Sincronizar DMS
      const latDms = decimalToDms(latitud, true);
      const lngDms = decimalToDms(longitud, false);

      setDmsLatG(String(latDms.grados));
      setDmsLatM(String(latDms.minutos).padStart(2, "0"));
      setDmsLatS(String(latDms.segundos));
      setDmsLatDir((latDms.direccion as "S" | "N") || "S");

      setDmsLngG(String(lngDms.grados));
      setDmsLngM(String(lngDms.minutos).padStart(2, "0"));
      setDmsLngS(String(lngDms.segundos));
      setDmsLngDir((lngDms.direccion as "W" | "O" | "E") || "W");
    }
  }, [latitud, longitud]);

  // Inicialización de Leaflet en el cliente
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      LRef.current = L;

      if (!isMounted || !mapContainerRef.current) return;

      const initialCenter: [number, number] =
        latitud !== null && longitud !== null
          ? [latitud, longitud]
          : ZARATE_CENTER;

      const initialZoom =
        latitud !== null && longitud !== null ? 16 : DEFAULT_ZOOM;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Icono de marcador SVG estilizado
      const pinIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="background: #2563eb; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.45); border: 2.5px solid #ffffff;">
              <span style="transform: rotate(45deg); font-size: 14px;">📍</span>
            </div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34],
      });

      // Si ya hay coordenadas, crear el marcador
      if (latitud !== null && longitud !== null) {
        const marker = L.marker([latitud, longitud], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          const cleanLat = Number(pos.lat.toFixed(6));
          const cleanLng = Number(pos.lng.toFixed(6));
          onChange(cleanLat, cleanLng);
        });

        markerRef.current = marker;
      }

      // Evento Click en cualquier punto del mapa
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        const cleanLat = Number(lat.toFixed(6));
        const cleanLng = Number(lng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([cleanLat, cleanLng]);
        } else {
          const marker = L.marker([cleanLat, cleanLng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          marker.on("dragend", (dragEvent: any) => {
            const pos = dragEvent.target.getLatLng();
            const dLat = Number(pos.lat.toFixed(6));
            const dLng = Number(pos.lng.toFixed(6));
            onChange(dLat, dLng);
          });

          markerRef.current = marker;
        }

        onChange(cleanLat, cleanLng);
      });

      mapInstanceRef.current = map;

      // Fix de tamaño cuando el contenedor se renderiza dentro de un modal
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Actualizar la posición del marcador si las props cambian externamente
  useEffect(() => {
    if (!mapInstanceRef.current || !LRef.current) return;

    if (latitud !== null && longitud !== null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitud, longitud]);
      } else {
        const pinIcon = LRef.current.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div style="background: #2563eb; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.45); border: 2.5px solid #ffffff;">
                <span style="transform: rotate(45deg); font-size: 14px;">📍</span>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34],
        });

        const marker = LRef.current
          .marker([latitud, longitud], {
            icon: pinIcon,
            draggable: true,
          })
          .addTo(mapInstanceRef.current);

        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          const cleanLat = Number(pos.lat.toFixed(6));
          const cleanLng = Number(pos.lng.toFixed(6));
          onChange(cleanLat, cleanLng);
        });

        markerRef.current = marker;
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [latitud, longitud, onChange]);

  // Aplicar un punto exacto en el mapa y notificar al formulario
  const aplicarPuntoExacto = (lat: number, lng: number) => {
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setFeedback({
        tipo: "error",
        mensaje: "Las coordenadas están fuera de rango geográfico válido (-90° a 90° Latitud, -180° a 180° Longitud).",
      });
      return;
    }

    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([cleanLat, cleanLng], 17, {
        duration: 1.2,
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([cleanLat, cleanLng]);
      } else if (LRef.current) {
        const pinIcon = LRef.current.divIcon({
          className: "custom-leaflet-marker",
          html: `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div style="background: #2563eb; color: white; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.45); border: 2.5px solid #ffffff;">
                <span style="transform: rotate(45deg); font-size: 14px;">📍</span>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -34],
        });

        const marker = LRef.current
          .marker([cleanLat, cleanLng], {
            icon: pinIcon,
            draggable: true,
          })
          .addTo(mapInstanceRef.current);

        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          onChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
        });

        markerRef.current = marker;
      }
    }

    onChange(cleanLat, cleanLng);
    const dmsFormateado = formatearDmsCompleto(cleanLat, cleanLng);
    setFeedback({
      tipo: "exito",
      mensaje: `✓ Punto exacto fijado en el mapa: ${cleanLat}, ${cleanLng} (${dmsFormateado})`,
    });
  };

  // Manejador: Modo Pegado / Detección inteligente
  const handleAplicarPegado = () => {
    if (!textoPegado.trim()) {
      setFeedback({
        tipo: "error",
        mensaje: "Por favor ingresa o pega las coordenadas antes de continuar.",
      });
      return;
    }

    const parsed = parsearCoordenadas(textoPegado);
    if (!parsed) {
      setFeedback({
        tipo: "error",
        mensaje:
          'Formato no reconocido. Ejemplos válidos: 34°05\'22.6"S 59°01\'56.3"W ó -34.089610, -59.032298 ó enlace de Google Maps.',
      });
      return;
    }

    aplicarPuntoExacto(parsed.lat, parsed.lng);
  };

  // Manejador: Modo Grados, Minutos y Segundos (GMS)
  const handleAplicarDMS = () => {
    const gLat = parseFloat(dmsLatG);
    const mLat = parseFloat(dmsLatM);
    const sLat = parseFloat(dmsLatS);

    const gLng = parseFloat(dmsLngG);
    const mLng = parseFloat(dmsLngM);
    const sLng = parseFloat(dmsLngS);

    if (
      isNaN(gLat) ||
      isNaN(mLat) ||
      isNaN(sLat) ||
      isNaN(gLng) ||
      isNaN(mLng) ||
      isNaN(sLng)
    ) {
      setFeedback({
        tipo: "error",
        mensaje: "Por favor completa todos los números de Grados, Minutos y Segundos de Latitud y Longitud.",
      });
      return;
    }

    const lat = dmsToDecimal(gLat, mLat, sLat, dmsLatDir);
    const lng = dmsToDecimal(gLng, mLng, sLng, dmsLngDir);

    aplicarPuntoExacto(lat, lng);
  };

  // Manejador: Modo Grados Decimales
  const handleAplicarDecimal = () => {
    const lat = parseFloat(decLat.replace(",", "."));
    const lng = parseFloat(decLng.replace(",", "."));

    if (isNaN(lat) || isNaN(lng)) {
      setFeedback({
        tipo: "error",
        mensaje: "Ingresa números válidos para Latitud y Longitud decimal (Ej: -34.089610 y -59.032298).",
      });
      return;
    }

    aplicarPuntoExacto(lat, lng);
  };

  // Cálculo en tiempo real de la previsualización DMS -> Decimal
  const previewDmsCalculado = useMemo(() => {
    const gLat = parseFloat(dmsLatG);
    const mLat = parseFloat(dmsLatM);
    const sLat = parseFloat(dmsLatS);
    const gLng = parseFloat(dmsLngG);
    const mLng = parseFloat(dmsLngM);
    const sLng = parseFloat(dmsLngS);

    if (
      isNaN(gLat) ||
      isNaN(mLat) ||
      isNaN(sLat) ||
      isNaN(gLng) ||
      isNaN(mLng) ||
      isNaN(sLng)
    ) {
      return null;
    }

    const lat = dmsToDecimal(gLat, mLat, sLat, dmsLatDir);
    const lng = dmsToDecimal(gLng, mLng, sLng, dmsLngDir);
    return { lat, lng };
  }, [
    dmsLatG,
    dmsLatM,
    dmsLatS,
    dmsLatDir,
    dmsLngG,
    dmsLngM,
    dmsLngS,
    dmsLngDir,
  ]);

  // Búsqueda de dirección con OpenStreetMap Nominatim
  const handleBuscarDireccion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    // Si el usuario escribió coordenadas directamente en el buscador tradicional, detectarlas primero
    const parsedDirect = parsearCoordenadas(searchQuery);
    if (parsedDirect) {
      aplicarPuntoExacto(parsedDirect.lat, parsedDirect.lng);
      return;
    }

    setIsSearching(true);
    setShowResults(false);

    try {
      const q = encodeURIComponent(`${searchQuery.trim()}, Zarate, Buenos Aires, Argentina`);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&addressdetails=1&limit=5`;

      const response = await fetch(url, {
        headers: {
          "Accept-Language": "es",
        },
      });

      if (!response.ok) {
        throw new Error("Error en la búsqueda");
      }

      const data: NominatimResult[] = await response.json();

      if (data.length === 1) {
        seleccionarUbicacion(data[0]);
      } else if (data.length > 1) {
        setSearchResults(data);
        setShowResults(true);
      } else {
        const qRelaxed = encodeURIComponent(`${searchQuery.trim()}, Zarate`);
        const resRelaxed = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${qRelaxed}&limit=5`
        );
        const dataRelaxed: NominatimResult[] = await resRelaxed.json();
        if (dataRelaxed.length > 0) {
          setSearchResults(dataRelaxed);
          setShowResults(true);
        } else {
          setSearchResults([]);
          setShowResults(true);
        }
      }
    } catch (err) {
      console.error("Error buscando dirección:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const seleccionarUbicacion = (item: NominatimResult) => {
    const lat = Number(parseFloat(item.lat).toFixed(6));
    const lng = Number(parseFloat(item.lon).toFixed(6));
    setShowResults(false);
    aplicarPuntoExacto(lat, lng);
  };

  const handleCentrarZarate = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(ZARATE_CENTER, DEFAULT_ZOOM, {
        duration: 1,
      });
    }
  };

  const handleLimpiarUbicacion = () => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    setFeedback(null);
    onChange(null, null);
  };

  return (
    <div className="map-selector-card">
      <div className="map-selector-header">
        <div className="map-selector-title-row">
          <h4 className="map-selector-title">
            <span className="map-icon">🗺️</span>
            <span>Ubicación Georreferenciada (Zárate)</span>
          </h4>
          <span className="map-hint">
            Haz click o arrastra el marcador para fijar el punto
          </span>
        </div>

        {/* Buscador de dirección tradicional */}
        <div className="map-search-wrapper">
          <div className="map-search-input-wrap">
            <svg
              className="map-search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="map-search-input"
              placeholder="Buscar por calle (Ej: Av. Mitre 500) o pegar coordenadas directamente..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBuscarDireccion();
                }
              }}
            />
          </div>

          <button
            type="button"
            className="map-btn-search"
            onClick={() => handleBuscarDireccion()}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? "Buscando..." : "Buscar"}
          </button>

          {showResults && (
            <div className="map-search-results">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <div
                    key={item.place_id}
                    className="map-search-item"
                    onClick={() => seleccionarUbicacion(item)}
                  >
                    <span>📍</span>
                    <span>{item.display_name}</span>
                  </div>
                ))
              ) : (
                <div className="map-search-item" style={{ color: "#94a3b8" }}>
                  No se encontraron resultados en Zárate. Usa el menú de marcar dirección exacta o haz click en el mapa.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botón Menú Desplegable: Marcar dirección exacta */}
        <div className="map-exact-trigger-wrap">
          <button
            type="button"
            className={`btn-toggle-coordenadas-exactas ${mostrarMenuExacto ? "active" : ""}`}
            onClick={() => {
              setMostrarMenuExacto((prev) => !prev);
              setFeedback(null);
            }}
          >
            <span className="btn-icon">🎯</span>
            <span className="btn-text">Marcar dirección exacta</span>
            <span className="btn-tag">Grados, Minutos, Segundos / Decimales</span>
            <span className="btn-chevron">{mostrarMenuExacto ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* Panel Desplegable interactivo */}
        {mostrarMenuExacto && (
          <div className="map-exact-dropdown-panel">
            {/* Pestañas de modo de carga */}
            <div className="map-exact-tabs">
              <button
                type="button"
                className={`map-exact-tab ${modoCarga === "pegado" ? "active" : ""}`}
                onClick={() => {
                  setModoCarga("pegado");
                  setFeedback(null);
                }}
              >
                <span>📋 Pegado Rápido (Auto)</span>
              </button>
              <button
                type="button"
                className={`map-exact-tab ${modoCarga === "dms" ? "active" : ""}`}
                onClick={() => {
                  setModoCarga("dms");
                  setFeedback(null);
                }}
              >
                <span>📐 Grados, Minutos y Segundos</span>
              </button>
              <button
                type="button"
                className={`map-exact-tab ${modoCarga === "decimal" ? "active" : ""}`}
                onClick={() => {
                  setModoCarga("decimal");
                  setFeedback(null);
                }}
              >
                <span>🔢 Grados Decimales</span>
              </button>
            </div>

            {/* Contenido Pestaña 1: Pegado rápido */}
            {modoCarga === "pegado" && (
              <div className="map-exact-content">
                <p className="map-exact-hint">
                  Pega las coordenadas tal cual las copiaste de Google Maps, GPS o celular (ej:{" "}
                  <strong>34°05'22.6"S 59°01'56.3"W</strong> ó{" "}
                  <strong>-34.089610, -59.032298</strong>).
                </p>
                <div className="map-exact-paste-box">
                  <input
                    type="text"
                    className="map-exact-paste-input"
                    placeholder='Ej: 34°05&#39;22.6"S 59°01&#39;56.3"W  ó  -34.089610, -59.032298'
                    value={textoPegado}
                    onChange={(e) => setTextoPegado(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAplicarPegado();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-aplicar-exacto"
                    onClick={handleAplicarPegado}
                  >
                    <span>Fijar en Mapa</span>
                  </button>
                </div>
              </div>
            )}

            {/* Contenido Pestaña 2: Grados, Minutos y Segundos detallado */}
            {modoCarga === "dms" && (
              <div className="map-exact-content">
                <p className="map-exact-hint">
                  Ingresa con precisión los Grados (°), Minutos ('), Segundos (") y Hemisferio:
                </p>
                <div className="dms-form-container">
                  {/* Fila Latitud */}
                  <div className="dms-row">
                    <span className="dms-row-label">🌐 Latitud:</span>
                    <div className="dms-fields-group">
                      <div className="dms-field-item">
                        <input
                          type="number"
                          className="dms-field-input"
                          placeholder="34"
                          value={dmsLatG}
                          onChange={(e) => setDmsLatG(e.target.value)}
                        />
                        <span className="dms-symbol">°</span>
                      </div>

                      <div className="dms-field-item">
                        <input
                          type="number"
                          className="dms-field-input"
                          placeholder="05"
                          value={dmsLatM}
                          onChange={(e) => setDmsLatM(e.target.value)}
                        />
                        <span className="dms-symbol">'</span>
                      </div>

                      <div className="dms-field-item">
                        <input
                          type="number"
                          step="any"
                          className="dms-field-input wide"
                          placeholder="22.6"
                          value={dmsLatS}
                          onChange={(e) => setDmsLatS(e.target.value)}
                        />
                        <span className="dms-symbol">"</span>
                      </div>

                      <select
                        className="dms-select-dir"
                        value={dmsLatDir}
                        onChange={(e) => setDmsLatDir(e.target.value as "S" | "N")}
                      >
                        <option value="S">S (Sur)</option>
                        <option value="N">N (Norte)</option>
                      </select>
                    </div>
                  </div>

                  {/* Fila Longitud */}
                  <div className="dms-row">
                    <span className="dms-row-label">🧭 Longitud:</span>
                    <div className="dms-fields-group">
                      <div className="dms-field-item">
                        <input
                          type="number"
                          className="dms-field-input"
                          placeholder="59"
                          value={dmsLngG}
                          onChange={(e) => setDmsLngG(e.target.value)}
                        />
                        <span className="dms-symbol">°</span>
                      </div>

                      <div className="dms-field-item">
                        <input
                          type="number"
                          className="dms-field-input"
                          placeholder="01"
                          value={dmsLngM}
                          onChange={(e) => setDmsLngM(e.target.value)}
                        />
                        <span className="dms-symbol">'</span>
                      </div>

                      <div className="dms-field-item">
                        <input
                          type="number"
                          step="any"
                          className="dms-field-input wide"
                          placeholder="56.3"
                          value={dmsLngS}
                          onChange={(e) => setDmsLngS(e.target.value)}
                        />
                        <span className="dms-symbol">"</span>
                      </div>

                      <select
                        className="dms-select-dir"
                        value={dmsLngDir}
                        onChange={(e) => setDmsLngDir(e.target.value as "W" | "O" | "E")}
                      >
                        <option value="W">W / O (Oeste)</option>
                        <option value="E">E (Este)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  {previewDmsCalculado && (
                    <span style={{ fontSize: "11px", color: "#166534", fontFamily: "JetBrains Mono, monospace" }}>
                      Equivalente decimal: {previewDmsCalculado.lat}, {previewDmsCalculado.lng}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-aplicar-exacto"
                    onClick={handleAplicarDMS}
                    style={{ marginLeft: "auto" }}
                  >
                    <span>Fijar Coordenadas GMS</span>
                  </button>
                </div>
              </div>
            )}

            {/* Contenido Pestaña 3: Decimal Directo */}
            {modoCarga === "decimal" && (
              <div className="map-exact-content">
                <p className="map-exact-hint">
                  Ingresa las coordenadas en formato decimal (ej: Latitud <strong>-34.089610</strong> y Longitud <strong>-59.032298</strong>):
                </p>
                <div className="decimal-form-row">
                  <div className="decimal-input-group">
                    <label>Latitud Decimal</label>
                    <input
                      type="text"
                      className="decimal-input-field"
                      placeholder="-34.089610"
                      value={decLat}
                      onChange={(e) => setDecLat(e.target.value)}
                    />
                  </div>
                  <div className="decimal-input-group">
                    <label>Longitud Decimal</label>
                    <input
                      type="text"
                      className="decimal-input-field"
                      placeholder="-59.032298"
                      value={decLng}
                      onChange={(e) => setDecLng(e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-aplicar-exacto"
                      onClick={handleAplicarDecimal}
                      style={{ height: "35px" }}
                    >
                      <span>Fijar Decimales</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Banner de feedback */}
            {feedback && (
              <div className={`map-exact-feedback ${feedback.tipo}`}>
                <span>{feedback.mensaje}</span>
                <button
                  type="button"
                  className="map-exact-feedback-close"
                  onClick={() => setFeedback(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenedor del Mapa */}
      <div className="map-canvas-container">
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Barra de Coordenadas y Acciones */}
      <div className="map-coords-bar">
        <div className="map-coords-display">
          <div className="coord-tag">
            <span className="coord-label">Latitud:</span>
            <span className={`coord-value ${latitud !== null ? "has-value" : ""}`}>
              {latitud !== null ? latitud : "No asignada"}
            </span>
          </div>

          <div className="coord-tag">
            <span className="coord-label">Longitud:</span>
            <span className={`coord-value ${longitud !== null ? "has-value" : ""}`}>
              {longitud !== null ? longitud : "No asignada"}
            </span>
          </div>

          {latitud !== null && longitud !== null && (
            <div className="coord-tag gms-tag">
              <span className="coord-label">GMS:</span>
              <span className="coord-value has-value gms-value">
                {formatearDmsCompleto(latitud, longitud)}
              </span>
              <button
                type="button"
                className="btn-copiar-gms"
                onClick={() => {
                  navigator.clipboard.writeText(formatearDmsCompleto(latitud, longitud));
                  setCopiadoDms(true);
                  setTimeout(() => setCopiadoDms(false), 2000);
                }}
                title="Copiar coordenadas en Grados, Minutos y Segundos al portapapeles"
              >
                {copiadoDms ? "✓ Copiado" : "📋 Copiar GMS"}
              </button>
            </div>
          )}
        </div>

        <div className="map-actions-group">
          <button
            type="button"
            className="btn-map-action"
            onClick={handleCentrarZarate}
            title="Volver a la vista general de Zárate"
          >
            🎯 Centrar Zárate
          </button>
          {latitud !== null && longitud !== null && (
            <button
              type="button"
              className="btn-map-action danger"
              onClick={handleLimpiarUbicacion}
              title="Quitar punto del mapa"
            >
              Quitar punto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
