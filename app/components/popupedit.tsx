"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "../css/popup.css";
import "../css/crudUsers.css";
import MapaSelector from "./mapaSelector";
import { OPCIONES_DEPARTAMENTO, IDS_DEPARTAMENTO } from "@/lib/departamentoConfig";
import { TIPOS_COMERCIO, esTarifaComercial } from "@/lib/comercioConfig";
import {
  ObservacionItem,
  obtenerFechaActualFormateada,
  parsearObservaciones,
  formatearObservacionesParaGuardar,
  formatearAFechaInput,
  formatearDesdeFechaInput,
} from "@/lib/observaciones";
import {
  ImagenItem,
  formatFechaImagen,
  getValidImageUrl,
  formatFileSize,
} from "@/lib/imageUtils";

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

  // Estados para gestión de fotografías
  const [imagenes, setImagenes] = useState<ImagenItem[]>([]);
  const [fotosNuevas, setFotosNuevas] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fotoFullscreen, setFotoFullscreen] = useState<string | null>(null);
  const [erroresCarga, setErroresCarga] = useState<Record<number, boolean>>({});
  const [imagenAEliminar, setImagenAEliminar] = useState<ImagenItem | null>(null);
  const [eliminandoFoto, setEliminandoFoto] = useState(false);
  const [subiendoFotosNuevas, setSubiendoFotosNuevas] = useState(false);
  const [duplicadoModal, setDuplicadoModal] = useState<{ nroUsuario: string; nombre?: string } | null>(null);

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
    rubroComercio: "",
    nombreComercio: "",
    paraCorte: false,
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

  const handleUpdateFechaObservacion = (id: string, fecha: string) => {
    setObservacionesList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, fecha } : item))
    );
  };

  const handleRemoveObservacion = (id: string) => {
    setObservacionesList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectFotosNuevas = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const items: { id: string; file: File; previewUrl: string }[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.warning(`El archivo "${file.name}" no es una imagen válida.`);
        return;
      }
      items.push({
        id: `edit-foto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    if (items.length > 0) {
      setFotosNuevas((prev) => [...prev, ...items]);
      toast.info(`Se ${items.length === 1 ? "agregó 1 foto" : `agregaron ${items.length} fotos`} para guardar.`);
    }
  };

  const handleRemoveFotoNueva = (id: string) => {
    setFotosNuevas((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSubirFotosNuevasDirecto = async () => {
    if (fotosNuevas.length === 0) return;
    setSubiendoFotosNuevas(true);
    let subidas = 0;
    try {
      for (const item of fotosNuevas) {
        const formDataImg = new FormData();
        formDataImg.append("archivo", item.file);
        formDataImg.append("usuarioId", String(usuarioId));

        const resImg = await fetch("/api/img", {
          method: "POST",
          body: formDataImg,
        });

        if (resImg.ok) {
          const imgGuardada = await resImg.json();
          setImagenes((prev) => [...prev, imgGuardada]);
          subidas++;
        }
      }
      if (subidas > 0) {
        toast.success(`¡${subidas} fotografía(s) subida(s) correctamente!`);
        fotosNuevas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setFotosNuevas([]);
      } else {
        toast.error("No se pudo subir ninguna fotografía.");
      }
    } catch (err) {
      console.error("Error al subir fotos:", err);
      toast.error("Ocurrió un error al subir las fotografías.");
    } finally {
      setSubiendoFotosNuevas(false);
    }
  };

  const handleConfirmarEliminarFoto = async () => {
    if (!imagenAEliminar) return;
    setEliminandoFoto(true);
    try {
      const res = await fetch(`/api/img?usuarioId=${usuarioId}&imagenId=${imagenAEliminar.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al eliminar la imagen");
      }
      setImagenes((prev) => prev.filter((img) => img.id !== imagenAEliminar.id));
      toast.success("Fotografía eliminada correctamente");
      setImagenAEliminar(null);
    } catch (err: any) {
      console.error("Error al eliminar foto:", err);
      toast.error(err.message || "Error al eliminar fotografía");
    } finally {
      setEliminandoFoto(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [resUser, resCuadrillas, resEstados, resTarifas, resImgs] = await Promise.all([
        fetch(`/api/users?id=${usuarioId}`),
        fetch("/api/cuadrillasapi"),
        fetch("/api/estadosapi"),
        fetch("/api/tarifasapi"),
        fetch(`/api/img?usuarioId=${usuarioId}`),
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
      const imgsData = resImgs.ok ? await resImgs.json() : [];

      setCuadrillas(cuadrillasData);
      setEstados(estadosData);
      setTarifas(tarifasData);
      setImagenes(Array.isArray(imgsData) ? imgsData : []);

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
        rubroComercio: userData.rubroComercio || userData.rubro?.nombre || "",
        nombreComercio: userData.nombreComercio || "",
        paraCorte: Boolean(userData.paraCorte),
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

    const tarifaActualObj = tarifas.find((t) => String(t.id) === String(formData.idTarifa));
    const esComercial = esTarifaComercial(tarifaActualObj?.nombre);

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
          rubroComercio: esComercial ? (formData.rubroComercio ? formData.rubroComercio.trim() : null) : null,
          nombreComercio: esComercial ? (formData.nombreComercio ? formData.nombreComercio.trim() : null) : null,
          paraCorte: formData.paraCorte,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.duplicado || res.status === 409) {
          setDuplicadoModal({
            nroUsuario: formData.nroUsuario.trim(),
            nombre: data.usuarioExistente?.nombre,
          });
        }
        toast.error(data.error || "Error al actualizar el usuario.");
        setSaving(false);
        return;
      }

      // Si hay fotos nuevas pendientes, subirlas
      if (fotosNuevas.length > 0) {
        let subidas = 0;
        for (const item of fotosNuevas) {
          try {
            const formDataImg = new FormData();
            formDataImg.append("archivo", item.file);
            formDataImg.append("usuarioId", String(usuarioId));

            const resImg = await fetch("/api/img", {
              method: "POST",
              body: formDataImg,
            });
            if (resImg.ok) subidas++;
          } catch (errFoto) {
            console.error("Error al subir foto:", errFoto);
          }
        }
        fotosNuevas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setFotosNuevas([]);
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

  // Detectar si la tarifa seleccionada es comercial (T1G o T1G-I)
  const tarifaActualObj = tarifas.find((t) => String(t.id) === String(formData.idTarifa));
  const esComercial = esTarifaComercial(tarifaActualObj?.nombre);

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

            {/* Condición Para Corte */}
            <div className="input-group form-col-span-2" style={{
              background: formData.paraCorte ? "#fef2f2" : "#f8fafc",
              border: formData.paraCorte ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "12px 16px",
              marginTop: "4px"
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 700, color: formData.paraCorte ? "#dc2626" : "#334155", margin: 0 }}>
                <input
                  type="checkbox"
                  name="paraCorte"
                  checked={formData.paraCorte}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paraCorte: e.target.checked }))}
                  style={{ width: "18px", height: "18px", accentColor: "#dc2626", cursor: "pointer" }}
                />
                <span style={{ fontSize: "14px" }}>✂️ Marcar usuario PARA CORTE</span>
              </label>
              <span style={{ fontSize: "12px", color: formData.paraCorte ? "#b91c1c" : "#64748b", marginTop: "4px", display: "block" }}>
                {formData.paraCorte
                  ? "Este usuario está marcado para corte. Su tarjeta aparecerá con fondo rojo en el home."
                  : "Por defecto el usuario no está marcado para corte."}
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
                    <label htmlFor="edit-rubro-comercio" style={{ color: "#166534", fontWeight: 700 }}>
                      Tipo de Comercio
                    </label>
                    <select
                      id="edit-rubro-comercio"
                      name="rubroComercio"
                      value={formData.rubroComercio}
                      onChange={handleChange}
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
                    <label htmlFor="edit-nombre-comercio" style={{ color: "#166534", fontWeight: 700 }}>
                      Nombre Informal del Comercio
                    </label>
                    <input
                      id="edit-nombre-comercio"
                      type="text"
                      name="nombreComercio"
                      value={formData.nombreComercio}
                      onChange={handleChange}
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

        {/* Sección 4: Fotografías del Usuario / Suministro */}
        <div className="form-section">
          <h4 className="section-title">
            <span className="section-num" style={{ background: "#0284c7" }}>4</span> Fotografías del Suministro / Medidor
          </h4>

          <div className="photos-section-box">
            {/* Zona para agregar nuevas fotos */}
            <div
              className={`photo-dropzone ${dragActive ? "drag-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleSelectFotosNuevas(e.dataTransfer.files);
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="photo-dropzone-input"
                onChange={(e) => {
                  handleSelectFotosNuevas(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="photo-dropzone-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p className="photo-dropzone-title">
                Hacé clic aquí o arrastrá fotos para agregar al usuario
              </p>
              <p className="photo-dropzone-subtitle">
                Podés subir varias fotos a la vez (medidor, fachada, acta, etc.)
              </p>
            </div>

            {/* Fotos nuevas pendientes de subida */}
            {fotosNuevas.length > 0 && (
              <div className="photos-grid-wrapper" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "12px" }}>
                <div className="photos-grid-header">
                  <span className="photos-grid-title" style={{ color: "#0369a1" }}>
                    <span>⏳ Nuevas fotos listas para subir:</span>
                    <span className="photos-counter-badge" style={{ background: "#0284c7", color: "#ffffff" }}>{fotosNuevas.length}</span>
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={handleSubirFotosNuevasDirecto}
                      disabled={subiendoFotosNuevas}
                      style={{
                        padding: "4px 10px",
                        background: "#0284c7",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {subiendoFotosNuevas ? "Subiendo..." : "Subir ahora"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fotosNuevas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
                        setFotosNuevas([]);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>

                <div className="photo-cards-grid">
                  {fotosNuevas.map((foto, idx) => (
                    <div key={foto.id} className="photo-preview-item">
                      <span className="photo-badge-status pending">Nueva #{idx + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.previewUrl} alt={`Foto nueva ${idx + 1}`} />

                      <div className="photo-item-actions">
                        <button
                          type="button"
                          className="photo-btn-action btn-zoom-photo"
                          onClick={() => setFotoFullscreen(foto.previewUrl)}
                          title="Ampliar vista previa"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="photo-btn-action btn-del-photo"
                          onClick={() => handleRemoveFotoNueva(foto.id)}
                          title="Quitar foto"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>

                      <div className="photo-bottom-caption">
                        <span className="photo-caption-name" title={foto.file.name}>{foto.file.name}</span>
                        <span className="photo-caption-size">{formatFileSize(foto.file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Galería de fotos guardadas en base de datos */}
            <div className="photos-grid-wrapper">
              <div className="photos-grid-header">
                <span className="photos-grid-title">
                  <span>📸 Fotos registradas del usuario:</span>
                  <span className="photos-counter-badge">{imagenes.length}</span>
                </span>
              </div>

              {imagenes.length === 0 ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px dashed #cbd5e1",
                  color: "#64748b",
                  fontSize: "13px"
                }}>
                  Este usuario no tiene fotos guardadas todavía.
                </div>
              ) : (
                <div className="photo-cards-grid">
                  {imagenes.map((imagen) => {
                    const validUrl = getValidImageUrl(imagen.url);
                    const fechaStr = formatFechaImagen(imagen);

                    if (erroresCarga[imagen.id]) {
                      return (
                        <div key={imagen.id} className="image-error-card" style={{ height: "125px" }}>
                          <span className="image-error-title" style={{ fontSize: "11px" }}>No encontrada</span>
                          <button
                            type="button"
                            className="image-error-del-btn"
                            onClick={() => setImagenAEliminar(imagen)}
                            title="Eliminar este registro huérfano"
                          >
                            Eliminar
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={imagen.id} className="photo-preview-item">
                        <span className="photo-badge-status saved">Guardada</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={validUrl}
                          alt="Imagen guardada"
                          onError={() => {
                            setErroresCarga((prev) => ({ ...prev, [imagen.id]: true }));
                          }}
                        />

                        <div className="photo-item-actions">
                          <button
                            type="button"
                            className="photo-btn-action btn-zoom-photo"
                            onClick={() => setFotoFullscreen(validUrl)}
                            title="Ver en pantalla completa"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="15 3 21 3 21 9" />
                              <polyline points="9 21 3 21 3 15" />
                              <line x1="21" y1="3" x2="14" y2="10" />
                              <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                          </button>
                          <a
                            href={validUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="photo-btn-action"
                            title="Descargar"
                            style={{ textDecoration: "none" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </a>
                          <button
                            type="button"
                            className="photo-btn-action btn-del-photo"
                            onClick={() => setImagenAEliminar(imagen)}
                            title="Eliminar foto"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>

                        {fechaStr && (
                          <div className="photo-bottom-caption">
                            <span className="photo-caption-name" title={fechaStr}>📅 {fechaStr}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                <span className="spinner"></span> Guardando cambios y fotos...
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guardar Cambios {fotosNuevas.length > 0 ? `(${fotosNuevas.length} fotos nuevas)` : ""}
              </>
            )}
          </button>
        </div>
      </form>

      {/* POPUP DE CONFIRMACIÓN PARA ELIMINAR FOTO EXISTENTE */}
      {imagenAEliminar && (
        <div className="confirm-delete-overlay" style={{ zIndex: 9999 }}>
          <div
            className="confirm-delete-card"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="modal-close-icon"
              onClick={() => !eliminandoFoto && setImagenAEliminar(null)}
              title="Cerrar"
              style={{ position: "absolute", top: "12px", right: "12px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="confirm-delete-icon-box">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h4 className="confirm-delete-title">¿Eliminar esta fotografía?</h4>
            <p className="confirm-delete-message">
              ¿Estás seguro de que deseas eliminar la fotografía? Esta acción es definitiva.
            </p>

            <div className="confirm-delete-preview-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getValidImageUrl(imagenAEliminar.url)}
                alt="Vista previa a eliminar"
                className="confirm-delete-thumb"
              />
            </div>

            <div className="confirm-delete-buttons">
              <button
                type="button"
                className="confirm-delete-btn-cancel"
                onClick={() => setImagenAEliminar(null)}
                disabled={eliminandoFoto}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-delete-btn-confirm"
                onClick={handleConfirmarEliminarFoto}
                disabled={eliminandoFoto}
              >
                {eliminandoFoto ? (
                  <>
                    <span className="spinner-confirm-del" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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

      {/* Modal Fullscreen para visualizar la foto en grande */}
      {fotoFullscreen && (
        <div
          className="fullscreen-image-overlay"
          onClick={() => setFotoFullscreen(null)}
          style={{ zIndex: 99999 }}
        >
          <div className="fullscreen-top-bar" onClick={(e) => e.stopPropagation()}>
            <a
              href={getValidImageUrl(fotoFullscreen)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="fullscreen-btn"
              title="Descargar imagen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>

            <button
              type="button"
              className="fullscreen-btn fullscreen-close-btn"
              onClick={() => setFotoFullscreen(null)}
              title="Cerrar pantalla completa"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            className="fullscreen-image-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getValidImageUrl(fotoFullscreen)}
              alt="Foto en pantalla completa"
              className="fullscreen-img"
            />
          </div>

          <div className="fullscreen-hint">
            Presioná la <strong>cruz ✕</strong> o haz clic afuera para salir
          </div>
        </div>
      )}

      {/* POPUP DE ALERTA CUANDO EL NÚMERO DE USUARIO YA PERTENECE A OTRO USUARIO */}
      {duplicadoModal && (
        <div
          className="modal-duplicate-overlay"
          onClick={() => setDuplicadoModal(null)}
          style={{ zIndex: 100000 }}
        >
          <div
            className="modal-duplicate-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-duplicate-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h3 className="modal-duplicate-title">Número de Usuario ya Asignado</h3>

            <p className="modal-duplicate-body">
              El número de usuario <span className="modal-duplicate-highlight">{duplicadoModal.nroUsuario}</span> ya pertenece a otro usuario en el sistema.
            </p>

            {duplicadoModal.nombre && (
              <div className="modal-duplicate-owner">
                <span style={{ fontSize: "18px" }}>👤</span>
                <div>
                  <strong style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#881337" }}>
                    Pertenece actualmente a:
                  </strong>
                  <span style={{ fontWeight: 700, fontSize: "13.5px" }}>{duplicadoModal.nombre}</span>
                </div>
              </div>
            )}

            <p style={{ fontSize: "12.5px", color: "#64748b", margin: "14px 0 18px" }}>
              No es posible guardar este cambio porque generaría un número de usuario duplicado. Por favor ingresa otro número.
            </p>

            <button
              type="button"
              className="modal-duplicate-btn"
              onClick={() => {
                setDuplicadoModal(null);
                const el = document.getElementById("edit-nroUsuario");
                if (el) el.focus();
              }}
            >
              <span>Entendido / Modificar número</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}