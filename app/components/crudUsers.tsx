"use client";
import "../css/crudUsers.css";
import { useState } from "react";
import { toast } from "react-toastify";
import MapaSelector from "./mapaSelector";
import { OPCIONES_DEPARTAMENTO, IDS_DEPARTAMENTO } from "@/lib/departamentoConfig";
import { TIPOS_COMERCIO, esTarifaComercial } from "@/lib/comercioConfig";
import {
  ObservacionItem,
  obtenerFechaActualFormateada,
  formatearObservacionesParaGuardar,
  formatearAFechaInput,
  formatearDesdeFechaInput,
} from "@/lib/observaciones";

export interface CatalogoItem {
  id: number;
  nombre: string;
}

type CrudUsersProps = {
  cuadrillas: CatalogoItem[];
  estados: CatalogoItem[];
  tarifas: CatalogoItem[];
  onUserCreated?: () => void;
  onClose?: () => void;
};

export default function CrudUsers({
  cuadrillas,
  estados,
  tarifas,
  onUserCreated,
  onClose,
}: CrudUsersProps) {
  const [nombre, setNombre] = useState("");
  const [nroUsuario, setNroUsuario] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [medidor, setMedidor] = useState("");
  const [ruta, setRuta] = useState("");
  const [maps, setMaps] = useState("");
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [selectedCuadrillas, setSelectedCuadrillas] = useState<number[]>([]);
  const [estadoId, setEstadoId] = useState("");
  const [tarifaId, setTarifaId] = useState("");
  const [rubroComercio, setRubroComercio] = useState("");
  const [nombreComercio, setNombreComercio] = useState("");
  const [fechaVto, setFechaVto] = useState("");
  const [paraCorte, setParaCorte] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para ¿Es departamento? (por defecto false)
  const [esDepartamento, setEsDepartamento] = useState(false);
  const [idEstadoDepto, setIdEstadoDepto] = useState<number | null>(null);

  // Múltiples observaciones con fecha automática
  const [observacionesList, setObservacionesList] = useState<ObservacionItem[]>([
    { id: "obs-1", texto: "", fecha: obtenerFechaActualFormateada() },
  ]);

  const toggleCuadrilla = (id: number) => {
    setSelectedCuadrillas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddObservacion = () => {
    setObservacionesList((prev) => [
      ...prev,
      {
        id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        texto: "",
        fecha: obtenerFechaActualFormateada(),
      },
    ]);
  };

  const handleUpdateObservacion = (id: string, texto: string) => {
    setObservacionesList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, texto } : item))
    );
  };

  const handleUpdateFechaObservacion = (id: string, fecha: string) => {
    setObservacionesList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, fecha } : item))
    );
  };

  const handleRemoveObservacion = (id: string) => {
    setObservacionesList((prev) => prev.filter((item) => item.id !== id));
  };

  const resetForm = () => {
    setNombre("");
    setNroUsuario("");
    setDomicilio("");
    setMedidor("");
    setRuta("");
    setFechaVto("");
    setMaps("");
    setLatitud(null);
    setLongitud(null);
    setSelectedCuadrillas([]);
    setEstadoId("");
    setTarifaId("");
    setRubroComercio("");
    setNombreComercio("");
    setEsDepartamento(false);
    setIdEstadoDepto(null);
    setParaCorte(false);
    setObservacionesList([
      { id: "obs-1", texto: "", fecha: obtenerFechaActualFormateada() },
    ]);
  };

  const handleSumbitUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!nombre.trim() || !nroUsuario.trim()) {
      toast.warning("El nombre y el número de usuario son obligatorios.");
      return;
    }

    if (!estadoId || !tarifaId) {
      toast.warning("Por favor, selecciona un estado y una tarifa.");
      return;
    }

    if (esDepartamento && !idEstadoDepto) {
      toast.warning("Selecciona una opción de acceso para el departamento.");
      return;
    }

    setIsSubmitting(true);

    const tarifaActualObj = tarifas.find((t) => String(t.id) === String(tarifaId));
    const esComercial = esTarifaComercial(tarifaActualObj?.nombre);

    try {
      const observacionesFormatted = formatearObservacionesParaGuardar(observacionesList);

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          nroUsuario: nroUsuario.trim(),
          domicilio: domicilio.trim() || null,
          medidor: medidor.trim() || null,
          ruta: ruta.trim() || null,
          fechaVto: fechaVto ? new Date(fechaVto + "T12:00:00Z").toISOString() : null,
          observaciones: observacionesFormatted,
          maps: maps.trim() || (latitud && longitud ? `https://www.google.com/maps?q=${latitud},${longitud}` : null),
          latitud,
          longitud,
          cuadrillaIds: selectedCuadrillas,
          idEstado: parseInt(estadoId, 10),
          idTarifa: parseInt(tarifaId, 10),
          esDepartamento,
          idEstadoDepto: esDepartamento ? idEstadoDepto : null,
          rubroComercio: esComercial ? (rubroComercio.trim() || null) : null,
          nombreComercio: esComercial ? (nombreComercio.trim() || null) : null,
          paraCorte,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear el usuario.");
        setIsSubmitting(false);
        return;
      }

      toast.success("¡Usuario creado exitosamente con sus datos, estado y departamento!");
      resetForm();

      if (onUserCreated) {
        onUserCreated();
      }

      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      toast.error("Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar estados normales para que no aparezcan los de departamento en el desplegable principal
  const estadosPrincipales = estados.filter((item) => !IDS_DEPARTAMENTO.includes(item.id));

  const tarifaActualObj = tarifas.find((t) => String(t.id) === String(tarifaId));
  const esComercial = esTarifaComercial(tarifaActualObj?.nombre);

  return (
    <div className="crud-user-wrapper">
      <div className="crud-user-header">
        <div className="crud-icon-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <div>
          <h2 className="crud-title">Nuevo Usuario con Fraude</h2>
          <p className="crud-subtitle">Completa los datos del usuario, medidor y asignación de múltiples cuadrillas</p>
        </div>
      </div>

      <form onSubmit={handleSumbitUser} className="crud-form">
        {/* Sección 1: Datos del Usuario */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">1</span> Información Personal, Medidor y Tipo de Inmueble
          </h4>
          <div className="form-grid">
            <div className="input-group">
              <label htmlFor="nroUsuario">Número de Usuario *</label>
              <input
                id="nroUsuario"
                type="text"
                placeholder="Ej: USR-10928"
                value={nroUsuario}
                onChange={(e) => setNroUsuario(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="nombre">Nombre Completo *</label>
              <input
                id="nombre"
                type="text"
                placeholder="Ej: Juan Carlos Pérez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="domicilio">Domicilio</label>
              <input
                id="domicilio"
                type="text"
                placeholder="Ej: Av. San Martín 1450"
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="medidor">N° de Medidor (1:1)</label>
              <input
                id="medidor"
                type="text"
                placeholder="Ej: MED-883920"
                value={medidor}
                onChange={(e) => setMedidor(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="ruta">Ruta / Sector</label>
              <input
                id="ruta"
                type="text"
                placeholder="Ej: RUTA-04 / Sector Norte"
                value={ruta}
                onChange={(e) => setRuta(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="fechaVto">Fecha Vto (Plazo de Pago)</label>
              <input
                id="fechaVto"
                type="date"
                value={fechaVto}
                onChange={(e) => setFechaVto(e.target.value)}
              />
            </div>

            {/* Clasificación de Departamento */}
            <div
              className={`depto-selection-box ${esDepartamento ? "active" : ""}`}
              style={{ gridColumn: "span 2" }}
            >
              <label className="depto-checkbox-label">
                <input
                  type="checkbox"
                  checked={esDepartamento}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEsDepartamento(checked);
                    if (!checked) {
                      setIdEstadoDepto(null);
                    } else if (!idEstadoDepto) {
                      setIdEstadoDepto(14); // Por defecto: SIN LLAVE (ID: 14)
                    }
                  }}
                  className="depto-checkbox"
                />
                <div className="depto-label-text">
                  <span className="depto-title">🏢 ¿Es departamento? (Edificio / PH)</span>
                  <span className="depto-desc">
                    Por defecto inactivo. Al marcarlo, podrás seleccionar la condición de llaves o portería.
                  </span>
                </div>
              </label>

              {esDepartamento && (
                <div className="depto-options-container">
                  <span className="depto-options-title">
                    Selecciona la condición de acceso al departamento:
                  </span>
                  <div className="depto-radio-grid">
                    {OPCIONES_DEPARTAMENTO.map((opcion) => {
                      const isSelected = idEstadoDepto === opcion.id;
                      return (
                        <button
                          key={opcion.id}
                          type="button"
                          className={`depto-card-option ${isSelected ? "selected" : ""}`}
                          onClick={() => setIdEstadoDepto(opcion.id)}
                        >
                          <div className="depto-card-header">
                            <span className="depto-card-icon">{opcion.icono}</span>
                            <span className="depto-card-id">ID: #{opcion.id}</span>
                          </div>
                          <div className="depto-card-name">{opcion.nombre}</div>
                          {opcion.descripcion && (
                            <div className="depto-card-desc">{opcion.descripcion}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2: Asignaciones */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">2</span> Asignación de Cuadrillas y Estado
          </h4>
          <div className="input-group">
            <label>Cuadrillas asignadas (opcional, puede quedar vacía):</label>
            <div className="cuadrillas-checkbox-grid" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "6px" }}>
              {cuadrillas.map((item) => {
                const isSelected = selectedCuadrillas.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleCuadrilla(item.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "20px",
                      border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                      color: isSelected ? "#1d4ed8" : "#475569",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease-in-out",
                      fontSize: "13px",
                    }}
                  >
                    <span>{isSelected ? "✓" : "+"}</span>
                    <span>{item.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: "12px" }}>
            <div className="input-group">
              <label htmlFor="estadoSelect">Estado del Fraude *</label>
              <select
                id="estadoSelect"
                value={estadoId}
                onChange={(e) => setEstadoId(e.target.value)}
                required
                className="select-custom"
              >
                <option value="">-- Seleccionar estado --</option>
                {estadosPrincipales.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} (ID: {item.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="tarifaSelect">Tarifa Aplicable *</label>
              <select
                id="tarifaSelect"
                value={tarifaId}
                onChange={(e) => setTarifaId(e.target.value)}
                required
                className="select-custom"
              >
                <option value="">-- Seleccionar tarifa --</option>
                {tarifas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} (ID: {item.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Condición Para Corte */}
            <div className="input-group form-col-span-2" style={{
              background: paraCorte ? "#fef2f2" : "#f8fafc",
              border: paraCorte ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "12px 16px",
              marginTop: "4px"
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 700, color: paraCorte ? "#dc2626" : "#334155", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={paraCorte}
                  onChange={(e) => setParaCorte(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#dc2626", cursor: "pointer" }}
                />
                <span style={{ fontSize: "14px" }}>✂️ Marcar usuario PARA CORTE</span>
              </label>
              <span style={{ fontSize: "12px", color: paraCorte ? "#b91c1c" : "#64748b", marginTop: "4px", display: "block" }}>
                {paraCorte
                  ? "Este usuario se creará marcado para corte y aparecerá con fondo rojo en el home."
                  : "Por defecto el usuario se creará sin marcar para corte."}
              </span>
            </div>

            {/* Bloque desplegable de Comercio para Tarifas T1G / T1G-I */}
            {esComercial && (
              <div
                className="comercio-selection-box"
                style={{
                  gridColumn: "span 2",
                  background: "#f0fdf4",
                  border: "1.5px solid #22c55e",
                  borderRadius: "12px",
                  padding: "16px",
                  marginTop: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 2px 8px rgba(34, 197, 94, 0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>🏪</span>
                  <div>
                    <h5 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#166534" }}>
                      Datos del Comercio (Tarifa: {tarifaActualObj?.nombre || "Comercial"})
                    </h5>
                    <p style={{ margin: 0, fontSize: "12px", color: "#15803d" }}>
                      Selecciona el tipo de comercio y asigna un nombre informal de referencia para identificar el local.
                    </p>
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: "4px" }}>
                  <div className="input-group">
                    <label htmlFor="create-rubro-comercio" style={{ color: "#166534", fontWeight: 700 }}>
                      Tipo de Comercio
                    </label>
                    <select
                      id="create-rubro-comercio"
                      value={rubroComercio}
                      onChange={(e) => setRubroComercio(e.target.value)}
                      className="select-custom"
                      style={{ borderColor: "#86efac", background: "#ffffff" }}
                    >
                      <option value="">-- Seleccionar tipo de comercio --</option>
                      {TIPOS_COMERCIO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="create-nombre-comercio" style={{ color: "#166534", fontWeight: 700 }}>
                      Nombre Informal del Comercio
                    </label>
                    <input
                      id="create-nombre-comercio"
                      type="text"
                      value={nombreComercio}
                      onChange={(e) => setNombreComercio(e.target.value)}
                      placeholder="Ej: Carnicería El Abasto, Supermercado Chino..."
                      className="input-custom"
                      style={{ borderColor: "#86efac", background: "#ffffff" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sección 3: Ubicación Georreferenciada y Observaciones */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">3</span> Ubicación en Zárate y Observaciones Técnicas
          </h4>

          {/* Selector de Mapa interactivo con Leaflet + OpenStreetMap */}
          <MapaSelector
            latitud={latitud}
            longitud={longitud}
            onChange={(lat, lng) => {
              setLatitud(lat);
              setLongitud(lng);
            }}
            domicilioSugerido={domicilio}
          />

          <div className="form-grid" style={{ marginTop: "12px" }}>
            <div className="input-group form-col-span-2">
              <label htmlFor="maps">Enlace adicional de Google Maps (opcional)</label>
              <div className="input-with-icon">
                <span className="field-icon">📍</span>
                <input
                  id="maps"
                  type="url"
                  placeholder={
                    latitud && longitud
                      ? `https://www.google.com/maps?q=${latitud},${longitud}`
                      : "https://maps.google.com/?q=..."
                  }
                  value={maps}
                  onChange={(e) => setMaps(e.target.value)}
                />
              </div>
            </div>

            {/* Múltiples observaciones con fecha automática */}
            <div className="input-group form-col-span-2">
              <div className="obs-builder-container">
                <div className="obs-builder-header">
                  <div className="obs-builder-title">
                    <span>Observaciones Técnicas / Detalle de la Deuda</span>
                    <span className="obs-count-badge">
                      {observacionesList.length} {observacionesList.length === 1 ? "observación" : "observaciones"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="obs-add-btn"
                    onClick={handleAddObservacion}
                  >
                    <span>+</span>
                    <span>Agregar otra observación</span>
                  </button>
                </div>

                {observacionesList.map((obs, index) => (
                  <div key={obs.id} className="obs-builder-item">
                    <div className="obs-item-topbar">
                      <span className="obs-item-label">
                        <span>📝</span> Observación #{index + 1}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div
                          className="obs-date-control"
                          title="Fecha de la observación. Haz clic para cambiarla."
                        >
                          <span style={{ fontSize: "13px" }}>📅</span>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Fecha:</span>
                          <input
                            type="date"
                            className="obs-date-input"
                            value={formatearAFechaInput(obs.fecha)}
                            onChange={(e) =>
                              handleUpdateFechaObservacion(
                                obs.id,
                                formatearDesdeFechaInput(e.target.value)
                              )
                            }
                            title="Haga clic para cambiar la fecha de esta observación"
                          />
                        </div>
                        {observacionesList.length > 1 && (
                          <button
                            type="button"
                            className="obs-item-remove-btn"
                            onClick={() => handleRemoveObservacion(obs.id)}
                            title="Eliminar esta observación"
                          >
                            ✕ Quitar
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      className="obs-item-textarea"
                      rows={2}
                      placeholder={`Detalle de la observación ${index + 1}...`}
                      value={obs.texto}
                      onChange={(e) => handleUpdateObservacion(obs.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="crud-actions">
          {onClose && (
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <span className="spinner"></span> Guardando usuario...
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guardar Usuario
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}