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
  const [ruta, setRuta] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [maps, setMaps] = useState("");
  const [cuadrillaId, setCuadrillaId] = useState("");
  const [estadoId, setEstadoId] = useState("");
  const [tarifaId, setTarifaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setNombre("");
    setNroUsuario("");
    setDomicilio("");
    setRuta("");
    setObservaciones("");
    setMaps("");
    setCuadrillaId("");
    setEstadoId("");
    setTarifaId("");
  };

  const handleSumbitUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!nombre.trim() || !nroUsuario.trim()) {
      toast.warning("El nombre y el número de usuario son obligatorios.");
      return;
    }

    if (!cuadrillaId || !estadoId || !tarifaId) {
      toast.warning("Por favor, selecciona una cuadrilla, un estado y una tarifa.");
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
          ruta: ruta.trim() || null,
          observaciones: observaciones.trim() || null,
          maps: maps.trim() || null,
          idCuadrilla: parseInt(cuadrillaId, 10),
          idEstado: parseInt(estadoId, 10),
          idTarifa: parseInt(tarifaId, 10),
          cuadrillaId: parseInt(cuadrillaId, 10),
          estadoId: parseInt(estadoId, 10),
          tarifaId: parseInt(tarifaId, 10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Error al crear el usuario.");
        setIsSubmitting(false);
        return;
      }

      toast.success("¡Usuario creado exitosamente con sus cuadrilla, estado y tarifa asignados!");
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
          <p className="crud-subtitle">Completa los datos del usuario y sus asignaciones correspondientes</p>
        </div>
      </div>

      <form onSubmit={handleSumbitUser} className="crud-form">
        {/* Sección: Datos del Usuario */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num">1</span> Información Personal y de Suministro
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
            <span className="section-num">2</span> Parámetros y Asignación Operativa *
          </h4>
          <div className="form-grid form-grid-3">
            <div className="input-group">
              <label htmlFor="cuadrillaSelect">Cuadrilla Asignada *</label>
              <select
                id="cuadrillaSelect"
                value={cuadrillaId}
                onChange={(e) => setCuadrillaId(e.target.value)}
                required
                className="select-custom"
              >
                <option value="">-- Seleccionar cuadrilla --</option>
                {cuadrillas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} (ID: {item.id})
                  </option>
                ))}
              </select>
            </div>

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