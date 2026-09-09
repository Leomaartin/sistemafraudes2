"use client";
import "../css/crudUsers.css";
import { useState } from "react";
import { toast } from "react-toastify";

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
  const [observaciones, setObservaciones] = useState("");
  const [maps, setMaps] = useState("");
  const [selectedCuadrillas, setSelectedCuadrillas] = useState<number[]>([]);
  const [estadoId, setEstadoId] = useState("");
  const [tarifaId, setTarifaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCuadrilla = (id: number) => {
    setSelectedCuadrillas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetForm = () => {
    setNombre("");
    setNroUsuario("");
    setDomicilio("");
    setMedidor("");
    setRuta("");
    setObservaciones("");
    setMaps("");
    setSelectedCuadrillas([]);
    setEstadoId("");
    setTarifaId("");
  };

  const handleSumbitUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!nombre.trim() || !nroUsuario.trim()) {
      toast.warning("El nombre y el número de usuario son obligatorios.");
      return;
    }

    if (selectedCuadrillas.length === 0) {
      toast.warning("Por favor, selecciona al menos una cuadrilla.");
      return;
    }

    if (!estadoId || !tarifaId) {
      toast.warning("Por favor, selecciona un estado y una tarifa.");
      return;
    }

    setIsSubmitting(true);

    try {
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
          observaciones: observaciones.trim() || null,
          maps: maps.trim() || null,
          cuadrillaIds: selectedCuadrillas,
          idEstado: parseInt(estadoId, 10),
          idTarifa: parseInt(tarifaId, 10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear el usuario.");
        setIsSubmitting(false);
        return;
      }

      toast.success("¡Usuario creado exitosamente con sus cuadrillas, medidor, estado y tarifa!");
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
        {/* Sección: Datos del Usuario */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">1</span> Información Personal y Medidor
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

            <div className="input-group form-col-span-2">
              <label htmlFor="ruta">Ruta / Sector</label>
              <input
                id="ruta"
                type="text"
                placeholder="Ej: RUTA-04 / Sector Norte"
                value={ruta}
                onChange={(e) => setRuta(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sección: Asignaciones */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">2</span> Selección de Múltiples Cuadrillas *
          </h4>
          <div className="input-group">
            <label>Selecciona una o más cuadrillas para este usuario:</label>
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
                {estados.map((item) => (
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
          </div>
        </div>

        {/* Sección: Ubicación y Observaciones */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">3</span> Ubicación Maps y Observaciones
          </h4>
          <div className="form-grid">
            <div className="input-group form-col-span-2">
              <label htmlFor="maps">Enlace de Google Maps</label>
              <div className="input-with-icon">
                <span className="field-icon">📍</span>
                <input
                  id="maps"
                  type="url"
                  placeholder="https://maps.google.com/?q=..."
                  value={maps}
                  onChange={(e) => setMaps(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group form-col-span-2">
              <label htmlFor="observaciones">Observaciones Técnicas / Detalle de la Deuda</label>
              <textarea
                id="observaciones"
                rows={3}
                placeholder="Ingrese detalles técnicos sobre la irregularidad detectada..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
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