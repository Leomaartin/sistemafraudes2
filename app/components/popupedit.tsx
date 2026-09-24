"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "../css/popup.css";
import "../css/crudUsers.css";
import MapaSelector from "./mapaSelector";
import { OPCIONES_DEPARTAMENTO, IDS_DEPARTAMENTO } from "@/lib/departamentoConfig";
import {
  ObservacionItem,
  obtenerFechaActualFormateada,
  parsearObservaciones,
  formatearObservacionesParaGuardar,
} from "@/lib/observaciones";

export interface CatalogoItem {
  id: number;
  nombre: string;
}

type PopupEditProps = {
  usuarioId: number;
  onClose?: () => void;
  onUserUpdated?: (usuarioActualizado: any) => void;
};

export default function PopupEdit({
  usuarioId,
  onClose,
  onUserUpdated,
}: PopupEditProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cuadrillas, setCuadrillas] = useState<CatalogoItem[]>([]);
  const [estados, setEstados] = useState<CatalogoItem[]>([]);
  const [tarifas, setTarifas] = useState<CatalogoItem[]>([]);

  const [selectedCuadrillas, setSelectedCuadrillas] = useState<number[]>([]);

  // Estado para ¿Es departamento?
  const [esDepartamento, setEsDepartamento] = useState(false);
  const [idEstadoDepto, setIdEstadoDepto] = useState<number | null>(null);

  // Múltiples observaciones con fecha
  const [observacionesList, setObservacionesList] = useState<ObservacionItem[]>([]);

  const [formData, setFormData] = useState({
    nroUsuario: "",
    nombre: "",
    domicilio: "",
    medidor: "",
    ruta: "",
    maps: "",
    latitud: null as number | null,
    longitud: null as number | null,
    idEstado: "",
    idTarifa: "",
    fechaVto: "",
  });

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

  const handleRemoveObservacion = (id: string) => {
    setObservacionesList((prev) => prev.filter((item) => item.id !== id));
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [resUser, resCuadrillas, resEstados, resTarifas] = await Promise.all([
        fetch(`/api/users?id=${usuarioId}`),
        fetch("/api/cuadrillasapi"),
        fetch("/api/estadosapi"),
        fetch("/api/tarifasapi"),
      ]);

      if (!resUser.ok) {
        const errorData = await resUser.json().catch(() => ({}));
        throw new Error(errorData.error || "No se pudo obtener la información del usuario");
      }

      const userData = await resUser.json();
      if (!userData) {
        throw new Error("Usuario no encontrado en la base de datos");
      }

      const cuadrillasData = resCuadrillas.ok ? await resCuadrillas.json() : [];
      const estadosData = resEstados.ok ? await resEstados.json() : [];
      const tarifasData = resTarifas.ok ? await resTarifas.json() : [];

      setCuadrillas(cuadrillasData);
      setEstados(estadosData);
      setTarifas(tarifasData);

      // Pre-cargar las cuadrillas asignadas al usuario
      let userCuadrillaIds: number[] = [];
      if (Array.isArray(userData.cuadrillas)) {
        userCuadrillaIds = userData.cuadrillas.map((c: any) => c.id);
      } else if (userData.idCuadrilla) {
        userCuadrillaIds = [userData.idCuadrilla];
      }
      setSelectedCuadrillas(userCuadrillaIds);

      // Determinar si es departamento
      const isDepto = Boolean(
        userData.esDepartamento ||
        userData.idEstadoDepto ||
        (userData.idEstado && IDS_DEPARTAMENTO.includes(Number(userData.idEstado)))
      );
      setEsDepartamento(isDepto);

      const deptoId = userData.idEstadoDepto
        ? Number(userData.idEstadoDepto)
        : (userData.idEstado && IDS_DEPARTAMENTO.includes(Number(userData.idEstado)))
        ? Number(userData.idEstado)
        : null;
      setIdEstadoDepto(deptoId);

      // Regular estado ID (no departamento)
      const regularEstadoId = (userData.idEstado && !IDS_DEPARTAMENTO.includes(Number(userData.idEstado)))
        ? String(userData.idEstado)
        : (userData.estado?.id && !IDS_DEPARTAMENTO.includes(Number(userData.estado.id)))
        ? String(userData.estado.id)
        : "";

      // Parsear observaciones existentes
      const parsedObs = parsearObservaciones(userData.observaciones);
      setObservacionesList(
        parsedObs.length > 0
          ? parsedObs
          : [{ id: "obs-1", texto: "", fecha: obtenerFechaActualFormateada() }]
      );

      setFormData({
        nroUsuario: userData.nroUsuario || "",
        nombre: userData.nombre || "",
        domicilio: userData.domicilio || "",
        medidor: userData.medidor || "",
        ruta: userData.ruta || "",
        maps: userData.maps || "",
        latitud:
          userData.latitud !== undefined && userData.latitud !== null
            ? Number(userData.latitud)
            : null,
        longitud:
          userData.longitud !== undefined && userData.longitud !== null
            ? Number(userData.longitud)
            : null,
        idEstado: regularEstadoId,
        idTarifa:
          userData.idTarifa != null
            ? String(userData.idTarifa)
            : userData.tarifa?.id != null
            ? String(userData.tarifa.id)
            : "",
        fechaVto: userData.fechaVto
          ? new Date(userData.fechaVto).toISOString().split("T")[0]
          : "",
      });
    } catch (err: any) {
      console.error("Error al cargar datos del usuario:", err);
      setLoadError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuarioId) {
      loadData();
    }
  }, [usuarioId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nroUsuario.trim() || !formData.nombre.trim()) {
      toast.warning("El número de usuario y el nombre son obligatorios.");
      return;
    }

    if (esDepartamento && !idEstadoDepto) {
      toast.warning("Selecciona una opción de acceso para el departamento.");
      return;
    }

    setSaving(true);

    try {
      const observacionesFormatted = formatearObservacionesParaGuardar(observacionesList);

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: usuarioId,
          nroUsuario: formData.nroUsuario.trim(),
          nombre: formData.nombre.trim(),
          domicilio: formData.domicilio.trim() || null,
          medidor: formData.medidor.trim() || null,
          ruta: formData.ruta.trim() || null,
          observaciones: observacionesFormatted,
          maps:
            formData.maps.trim() ||
            (formData.latitud && formData.longitud
              ? `https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`
              : null),
          latitud: formData.latitud,
          longitud: formData.longitud,
          cuadrillaIds: selectedCuadrillas,
          idEstado: formData.idEstado ? parseInt(formData.idEstado, 10) : null,
          idTarifa: formData.idTarifa ? parseInt(formData.idTarifa, 10) : null,
          fechaVto: formData.fechaVto ? new Date(formData.fechaVto + "T12:00:00Z").toISOString() : null,
          esDepartamento,
          idEstadoDepto: esDepartamento ? idEstadoDepto : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al actualizar el usuario.");
        setSaving(false);
        return;
      }

      toast.success("¡Usuario actualizado correctamente!");

      if (onUserUpdated) {
        onUserUpdated(data);
      }
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      toast.error("Ocurrió un error inesperado al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="crud-user-wrapper" style={{ minHeight: "350px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <div className="spinner" style={{ width: "36px", height: "36px", borderColor: "rgba(37, 99, 235, 0.2)", borderTopColor: "#2563eb" }}></div>
        <p style={{ color: "#64748b", fontWeight: 500, fontSize: "15px" }}>Cargando datos del usuario #{usuarioId}...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="crud-user-wrapper" style={{ padding: "40px 25px", textAlign: "center" }}>
        <div style={{ width: "50px", height: "50px", margin: "0 auto 16px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 style={{ margin: "0 0 8px", color: "#1e293b", fontSize: "18px" }}>Error al cargar usuario</h3>
        <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "14px" }}>{loadError}</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {onClose && (
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cerrar
            </button>
          )}
          <button type="button" className="btn-submit" onClick={loadData}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Filtrar estados normales para que no aparezcan los de departamento en el desplegable principal
  const estadosPrincipales = estados.filter((item) => !IDS_DEPARTAMENTO.includes(item.id));

  return (
    <div className="crud-user-wrapper">
      <div className="crud-user-header">
        <div className="crud-icon-badge" style={{ background: "#e0f2fe", color: "#0284c7" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <div>
          <h2 className="crud-title">Editar Usuario</h2>
          <p className="crud-subtitle">
            Modifica la información, medidor y asignación de múltiples cuadrillas del usuario #{usuarioId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="crud-form">
        {/* Sección 1: Información Personal y de Suministro */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num" style={{ background: "#0284c7" }}>1</span> Información Personal, Medidor y Tipo de Inmueble
          </h4>
          <div className="form-grid">
            <div className="input-group">
              <label htmlFor="edit-nroUsuario">Número de Usuario *</label>
              <input
                id="edit-nroUsuario"
                name="nroUsuario"
                type="text"
                placeholder="Ej: USR-10928"
                value={formData.nroUsuario}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="edit-nombre">Nombre Completo *</label>
              <input
                id="edit-nombre"
                name="nombre"
                type="text"
                placeholder="Ej: Juan Carlos Pérez"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="edit-domicilio">Domicilio</label>
              <input
                id="edit-domicilio"
                name="domicilio"
                type="text"
                placeholder="Ej: Av. San Martín 1450"
                value={formData.domicilio}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label htmlFor="edit-medidor">N° de Medidor (1:1)</label>
              <input
                id="edit-medidor"
                name="medidor"
                type="text"
                placeholder="Ej: MED-883920"
                value={formData.medidor}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label htmlFor="edit-ruta">Ruta / Sector</label>
              <input
                id="edit-ruta"
                name="ruta"
                type="text"
                placeholder="Ej: RUTA-04 / Sector Norte"
                value={formData.ruta}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label htmlFor="edit-fechavto">Fecha Vto (Plazo de Pago)</label>
              <input
                id="edit-fechavto"
                name="fechaVto"
                type="date"
                value={formData.fechaVto}
                onChange={handleChange}
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

        {/* Sección 2: Parámetros y Asignación Operativa */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num" style={{ background: "#0284c7" }}>2</span> Selección de Múltiples Cuadrillas
          </h4>
          <div className="input-group">
            <label>Cuadrillas Asignadas:</label>
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
                      border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                      backgroundColor: isSelected ? "#e0f2fe" : "#ffffff",
                      color: isSelected ? "#0369a1" : "#475569",
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
              <label htmlFor="edit-estado">Estado del Fraude</label>
              <select
                id="edit-estado"
                name="idEstado"
                value={formData.idEstado}
                onChange={handleChange}
                className="select-custom"
              >
                <option value="">-- Sin asignar --</option>
                {estadosPrincipales.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} (ID: {item.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="edit-tarifa">Tarifa Aplicable</label>
              <select
                id="edit-tarifa"
                name="idTarifa"
                value={formData.idTarifa}
                onChange={handleChange}
                className="select-custom"
              >
                <option value="">-- Sin asignar --</option>
                {tarifas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} (ID: {item.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sección 3: Ubicación Georreferenciada y Observaciones */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num" style={{ background: "#0284c7" }}>3</span> Ubicación en Zárate y Observaciones Técnicas
          </h4>

          {/* Selector de Mapa interactivo con Leaflet + OpenStreetMap */}
          <MapaSelector
            latitud={formData.latitud}
            longitud={formData.longitud}
            onChange={(lat, lng) => {
              setFormData((prev) => ({
                ...prev,
                latitud: lat,
                longitud: lng,
              }));
            }}
            domicilioSugerido={formData.domicilio}
          />

          <div className="form-grid" style={{ marginTop: "12px" }}>
            <div className="input-group form-col-span-2">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="edit-maps">Enlace adicional de Google Maps</label>
                {(formData.maps || (formData.latitud && formData.longitud)) && (
                  <a
                    href={
                      formData.maps ||
                      `https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "#dc2626", textDecoration: "none", fontWeight: 600 }}
                  >
                    ↗ Abrir en Google Maps
                  </a>
                )}
              </div>
              <div className="input-with-icon">
                <span className="field-icon">📍</span>
                <input
                  id="edit-maps"
                  name="maps"
                  type="url"
                  placeholder={
                    formData.latitud && formData.longitud
                      ? `https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`
                      : "https://maps.google.com/?q=..."
                  }
                  value={formData.maps}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Múltiples observaciones con fecha automática */}
            <div className="input-group form-col-span-2">
              <div className="obs-builder-container">
                <div className="obs-builder-header">
                  <div className="obs-builder-title">
                    <span>Observaciones Técnicas / Historial de Notas</span>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="obs-item-date-tag">
                          📅 Fecha de carga: {obs.fecha} (automática)
                        </span>
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
              disabled={saving}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="btn-submit"
            style={{ background: "linear-gradient(135deg, #0284c7, #0369a1)" }}
            disabled={saving}
          >
            {saving ? (
              <span className="btn-loading-content">
                <span className="spinner"></span> Guardando cambios...
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}