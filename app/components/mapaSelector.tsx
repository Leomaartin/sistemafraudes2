"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "../css/mapa.css";

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

  const [searchQuery, setSearchQuery] = useState(domicilioSugerido);
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Sincronizar búsqueda cuando cambia el domicilio sugerido del formulario
  useEffect(() => {
    if (domicilioSugerido && !searchQuery) {
      setSearchQuery(domicilioSugerido);
    }
  }, [domicilioSugerido]);

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

  // Búsqueda de dirección con OpenStreetMap Nominatim
  const handleBuscarDireccion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

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
        // Si hay un resultado directo, posicionar de una vez
        seleccionarUbicacion(data[0]);
      } else if (data.length > 1) {
        setSearchResults(data);
        setShowResults(true);
      } else {
        // Intento con búsqueda más relajada si no encontró con Argentina
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

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 17, {
        duration: 1.2,
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
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
          .marker([lat, lng], {
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
    }

    onChange(lat, lng);
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

        {/* Buscador de dirección */}
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
              placeholder="Buscar dirección en Zárate (Ej: Av. Mitre 500, Lavalle...)"
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
                  No se encontraron resultados en Zárate. Prueba haciendo click directamente en el mapa.
                </div>
              )}
            </div>
          )}
        </div>
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
