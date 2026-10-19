"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../css/armarListado.css";

interface CatalogoItem {
  id: number;
  nombre: string;
}

interface RutaItem {
  ruta: string;
  cantidad: number;
}

interface UsuarioSelectable {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string | null;
  medidor: string | null;
  ruta: string | null;
}

interface ListadoItem {
  id: number;
  idListado: number;
  idUsuario: number;
  titulo?: string | null;
  completado: boolean;
  fechaCompletado: string | null;
  orden: number;
  usuario: {
    id: number;
    nroUsuario: string;
    nombre: string;
    domicilio: string | null;
    medidor: string | null;
    ruta: string | null;
  };
}

interface ListadoCard {
  id: number;
  titulo: string;
  descripcion: string | null;
  idCuadrilla: number;
  completado?: boolean;
  fechaCompletado?: string | null;
  terminado?: boolean;
  fechaTerminado?: string | null;
  createdAt: string;
  cuadrilla: {
    id: number;
    nombre: string;
  };
  items: ListadoItem[];
  stats: {
    total: number;
    completados: number;
    pendientes: number;
    porcentaje: number;
  };
}

type ModoSeleccion = "ruta" | "personalizada";

export default function ArmarListadoPage() {
  const [activeTab, setActiveTab] = useState<"crear" | "monitoreo">("crear");
  const [cargando, setCargando] = useState(true);

  // Catálogos y datos
  const [cuadrillas, setCuadrillas] = useState<CatalogoItem[]>([]);
  const [rutasDisponibles, setRutasDisponibles] = useState<RutaItem[]>([]);
  const [totalUsuariosSistema, setTotalUsuariosSistema] = useState<number>(0);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<UsuarioSelectable[]>([]);

  // Formulario
  const [tituloListado, setTituloListado] = useState("");
  const [idCuadrillaSeleccionada, setIdCuadrillaSeleccionada] = useState<number | "">("");
  const [descripcionListado, setDescripcionListado] = useState("");
  const [modoSeleccion, setModoSeleccion] = useState<ModoSeleccion>("ruta");
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState("");
  const [filtroRutaManual, setFiltroRutaManual] = useState<string>("todas");
  const [paginaSeleccionPersonalizada, setPaginaSeleccionPersonalizada] = useState<number>(1);
  const [titulosIndividuales, setTitulosIndividuales] = useState<Record<number, string>>({});
  const [tituloMasivo, setTituloMasivo] = useState<string>("");
  const [mostrarPersonalizacionRuta, setMostrarPersonalizacionRuta] = useState<boolean>(false);
  const [enviando, setEnviando] = useState(false);

  // Monitoreo en vivo
  const [listadosActivos, setListadosActivos] = useState<ListadoCard[]>([]);
  const [listadosExpandidos, setListadosExpandidos] = useState<Record<number, boolean>>({});
  const [busquedaMonitoreo, setBusquedaMonitoreo] = useState<Record<number, string>>({});
  const [filtroEstadoMonitoreo, setFiltroEstadoMonitoreo] = useState<Record<number, "todos" | "pendientes" | "completados">>({});
  const [paginaMonitoreo, setPaginaMonitoreo] = useState<Record<number, number>>({});
  const [filtroListadosTab, setFiltroListadosTab] = useState<"todos" | "completados" | "en_progreso" | "terminados">("todos");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());
  const [actualizandoEnVivo, setActualizandoEnVivo] = useState(false);

  // Cargar datos iniciales (cuadrillas, conteo total y rutas)
  const fetchDatosIniciales = useCallback(async () => {
    try {
      setCargando(true);
      const [resCuad, resRutas, resUsers] = await Promise.all([
        fetch("/api/cuadrillasapi"),
        fetch("/api/listados/rutas"),
        fetch("/api/usuariosapi"),
      ]);

      if (resCuad.ok) {
        const dataCuad = await resCuad.json();
        setCuadrillas(dataCuad);
        if (dataCuad.length > 0 && idCuadrillaSeleccionada === "") {
          setIdCuadrillaSeleccionada(dataCuad[0].id);
        }
      }

      if (resRutas.ok) {
        const dataRutas = await resRutas.json();
        setTotalUsuariosSistema(dataRutas.totalUsuarios || 0);
        setRutasDisponibles(dataRutas.rutas || []);
        if (dataRutas.rutas?.length > 0 && !rutaSeleccionada) {
          setRutaSeleccionada(dataRutas.rutas[0].ruta);
        }
      }

      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsuariosDisponibles(dataUsers);
      }
    } catch (err) {
      console.error("Error al cargar datos iniciales:", err);
      toast.error("Error al cargar datos del sistema.");
    } finally {
      setCargando(false);
    }
  }, [idCuadrillaSeleccionada, rutaSeleccionada]);

  // Cargar listados para monitoreo
  const fetchListados = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setActualizandoEnVivo(true);
      const res = await fetch("/api/listados");
      if (res.ok) {
        const data = await res.json();
        setListadosActivos(data);
        setUltimaActualizacion(new Date());
      }
    } catch (err) {
      console.error("Error al obtener listados:", err);
    } finally {
      if (!silencioso) setActualizandoEnVivo(false);
    }
  }, []);

  useEffect(() => {
    fetchDatosIniciales();
    fetchListados();
  }, [fetchDatosIniciales, fetchListados]);

  // Auto-actualización cada 6 segundos en pestaña monitoreo
  useEffect(() => {
    const interval = setInterval(() => {
      fetchListados(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchListados]);

  // Calcular la cantidad de usuarios que se agregarán según el modo
  const cantidadUsuariosEstimada = useMemo(() => {
    if (modoSeleccion === "ruta") {
      const r = rutasDisponibles.find((item) => item.ruta === rutaSeleccionada);
      return r ? r.cantidad : 0;
    }
    return selectedUserIds.length;
  }, [modoSeleccion, rutasDisponibles, rutaSeleccionada, selectedUserIds]);

  // Filtrado de usuarios para selección personalizada (entre todos los usuarios del sistema)
  const usuariosFiltradosPersonalizada = useMemo(() => {
    let list = usuariosDisponibles;
    if (filtroRutaManual !== "todas") {
      list = list.filter((u) => u.ruta === filtroRutaManual);
    }
    const term = searchUserTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((u) => {
        const nro = (u.nroUsuario || "").toLowerCase();
        const nom = (u.nombre || "").toLowerCase();
        const dom = (u.domicilio || "").toLowerCase();
        const rut = (u.ruta || "").toLowerCase();
        const med = (u.medidor || "").toLowerCase();
        return nro.includes(term) || nom.includes(term) || dom.includes(term) || rut.includes(term) || med.includes(term);
      });
    }
    return list;
  }, [usuariosDisponibles, filtroRutaManual, searchUserTerm]);

  // Paginación para tabla de selección personalizada
  const USERS_PER_PAGE = 30;
  const totalPaginasSeleccion = Math.ceil(usuariosFiltradosPersonalizada.length / USERS_PER_PAGE) || 1;
  const usuariosPaginadosSeleccion = useMemo(() => {
    return usuariosFiltradosPersonalizada.slice(
      (paginaSeleccionPersonalizada - 1) * USERS_PER_PAGE,
      paginaSeleccionPersonalizada * USERS_PER_PAGE
    );
  }, [usuariosFiltradosPersonalizada, paginaSeleccionPersonalizada]);

  // Usuarios seleccionados que formarán la lista armada
  const usuariosSeleccionadosLista = useMemo(() => {
    const map = new Map(usuariosDisponibles.map((u) => [u.id, u]));
    return selectedUserIds
      .map((id) => map.get(id))
      .filter(Boolean) as UsuarioSelectable[];
  }, [selectedUserIds, usuariosDisponibles]);

  // Usuarios de la ruta seleccionada (si el modo es por ruta)
  const usuariosDeRutaSeleccionada = useMemo(() => {
    if (modoSeleccion !== "ruta" || !rutaSeleccionada) return [];
    return usuariosDisponibles.filter((u) => u.ruta === rutaSeleccionada);
  }, [modoSeleccion, rutaSeleccionada, usuariosDisponibles]);

  // Manejo de títulos individuales
  const handleSetTituloIndividual = (userId: number, titulo: string) => {
    setTitulosIndividuales((prev) => ({
      ...prev,
      [userId]: titulo,
    }));
  };

  const sugerenciasTitulos = ["Corte", "Reconexión", "Retiro de Medidor", "Inspección", "Verificación"];

  const handleAplicarTituloATodos = (titulo: string) => {
    if (!titulo.trim()) return;
    const t = titulo.trim();
    setTituloMasivo(t);
    if (modoSeleccion === "personalizada") {
      setTitulosIndividuales((prev) => {
        const next = { ...prev };
        selectedUserIds.forEach((uid) => {
          next[uid] = t;
        });
        return next;
      });
      toast.info(`Título "${t}" aplicado a los ${selectedUserIds.length} usuarios seleccionados.`);
    } else if (modoSeleccion === "ruta") {
      setTitulosIndividuales((prev) => {
        const next = { ...prev };
        usuariosDeRutaSeleccionada.forEach((u) => {
          next[u.id] = t;
        });
        return next;
      });
      toast.info(`Título "${t}" establecido para los usuarios de la Ruta ${rutaSeleccionada}.`);
    }
  };

  // Manejo de selección en modo personalizada
  const toggleSelectUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectTodosLosFiltrados = () => {
    const ids = usuariosFiltradosPersonalizada.map((u) => u.id);
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const selectTodosDisponibles = () => {
    const ids = usuariosDisponibles.map((u) => u.id);
    setSelectedUserIds(ids);
  };

  const deseleccionarTodos = () => {
    setSelectedUserIds([]);
  };

  const quitarUsuarioSeleccionado = (id: number) => {
    setSelectedUserIds((prev) => prev.filter((item) => item !== id));
  };

  // Crear listado
  const handleCrearListado = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tituloListado.trim()) {
      toast.warning("Por favor ingresa un título para el listado (ej: barrio viperun).");
      return;
    }

    if (!idCuadrillaSeleccionada) {
      toast.warning("Por favor selecciona la cuadrilla de destino.");
      return;
    }

    if (modoSeleccion === "personalizada" && selectedUserIds.length === 0) {
      toast.warning("Selecciona al menos un usuario para armar el listado.");
      return;
    }

    if (modoSeleccion === "ruta" && !rutaSeleccionada) {
      toast.warning("Por favor selecciona una ruta.");
      return;
    }

    setEnviando(true);
    try {
      const payload: any = {
        titulo: tituloListado.trim(),
        idCuadrilla: Number(idCuadrillaSeleccionada),
        descripcion: descripcionListado.trim() || null,
        defaultTitulo: tituloMasivo.trim() || null,
        titulos: titulosIndividuales,
      };

      if (modoSeleccion === "ruta") {
        payload.filtroRuta = rutaSeleccionada;
      } else {
        payload.userIds = selectedUserIds;
      }

      const res = await fetch("/api/listados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al crear el listado");
      }

      toast.success(data.message || "¡Listado enviado a la cuadrilla exitosamente!");
      setTituloListado("");
      setDescripcionListado("");
      setSelectedUserIds([]);
      setTitulosIndividuales({});
      setTituloMasivo("");
      setSearchUserTerm("");
      await fetchListados();
      setActiveTab("monitoreo");
    } catch (err: any) {
      console.error("Error al enviar listado:", err);
      toast.error(err?.message || "Ocurrió un error al enviar el listado.");
    } finally {
      setEnviando(false);
    }
  };

  const toggleExpandirListado = (id: number) => {
    setListadosExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleItemAdmin = async (itemId: number, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    try {
      const res = await fetch("/api/listados/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, completado: nuevoEstado }),
      });
      if (!res.ok) throw new Error("Error al modificar estado.");
      fetchListados(true);
    } catch (err) {
      console.error("Error:", err);
      toast.error("No se pudo actualizar el estado del item.");
    }
  };

  const handleEditarTituloItem = async (itemId: number, tituloActual: string, nombreUsuario: string) => {
    const nuevo = window.prompt(
      `Ingresa el nuevo título individual para el usuario "${nombreUsuario}":\n(Ej: corte, reconexión, retiro, inspección...)`,
      tituloActual || ""
    );
    if (nuevo === null) return;
    try {
      const res = await fetch("/api/listados/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, titulo: nuevo }),
      });
      if (!res.ok) throw new Error("Error al modificar el título.");
      toast.success("Título individual actualizado.");
      fetchListados(true);
    } catch (err) {
      console.error("Error:", err);
      toast.error("No se pudo actualizar el título individual.");
    }
  };

  const handleToggleTerminadoListado = async (id: number, titulo: string, estadoActual: boolean) => {
    const nuevo = !estadoActual;
    const msg = nuevo
      ? `¿Confirmas que deseas DAR POR TERMINADO el listado "${titulo}"?\n\nEl listado quedará formalmente cerrado y archivado como completado.`
      : `¿Deseas reabrir el listado "${titulo}" para que siga activo?`;
    if (!window.confirm(msg)) return;

    try {
      const res = await fetch("/api/listados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idListado: id, terminado: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar estado");
      toast.success(nuevo ? "Listado dado por terminado exitosamente." : "Listado reabierto.");
      fetchListados(true);
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err.message || "No se pudo actualizar el estado del listado.");
    }
  };

  const handleEliminarListado = async (id: number, titulo: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el listado "${titulo}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/listados?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      toast.success("Listado eliminado.");
      fetchListados();
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err?.message || "Error al eliminar listado.");
    }
  };

  const cuadrillaSeleccionadaObj = cuadrillas.find((c) => c.id === idCuadrillaSeleccionada);

  return (
    <div className="armar-listado-container">
      <ToastContainer position="top-right" autoClose={3500} theme="colored" />

      <div className="armar-listado-card">
        {/* Cabecera */}
        <div className="armar-listado-header">
          <div>
            <h1>Gestión y Armado de Listados</h1>
            <p>
              Crea listados con título personalizado para cuadrillas (todos los usuarios, por ruta o selección manual) y monitorea el avance en vivo.
            </p>
          </div>
          <Link
            href="/usuarios"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#f1f5f9",
              color: "#334155",
              padding: "10px 18px",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "14px",
              textDecoration: "none",
              border: "1px solid #cbd5e1",
            }}
          >
            ← Volver al Sistema
          </Link>
        </div>

        {/* Pestañas */}
        <div className="armar-tabs">
          <button
            type="button"
            onClick={() => setActiveTab("crear")}
            className={`armar-tab-btn ${activeTab === "crear" ? "is-active" : ""}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Armar Nuevo Listado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monitoreo")}
            className={`armar-tab-btn ${activeTab === "monitoreo" ? "is-active" : ""}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>Monitoreo en Vivo</span>
            {listadosActivos.length > 0 && (
              <span
                style={{
                  background: activeTab === "monitoreo" ? "#107c41" : "#94a3b8",
                  color: "#ffffff",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 800,
                }}
              >
                {listadosActivos.length}
              </span>
            )}
          </button>
        </div>

        {/* ==========================================================
            PESTAÑA 1: ARMAR NUEVO LISTADO
            ========================================================== */}
        {activeTab === "crear" && (
          <form onSubmit={handleCrearListado}>
            <div className="armar-form-grid">
              <div className="armar-field-group">
                <label className="armar-label">Título del Listado *</label>
                <input
                  type="text"
                  required
                  className="armar-input"
                  placeholder="Ej: Operativo Villa Fox - Turno Mañana"
                  value={tituloListado}
                  onChange={(e) => setTituloListado(e.target.value)}
                />
              </div>

              <div className="armar-field-group">
                <label className="armar-label">Cuadrilla Asignada *</label>
                <select
                  required
                  className="armar-select"
                  value={idCuadrillaSeleccionada}
                  onChange={(e) => setIdCuadrillaSeleccionada(Number(e.target.value))}
                >
                  {cuadrillas.length === 0 ? (
                    <option value="">Cargando cuadrillas...</option>
                  ) : (
                    cuadrillas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} (ID: #{c.id})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="armar-field-group" style={{ marginBottom: "22px" }}>
              <label className="armar-label">Descripción u Observaciones (Opcional)</label>
              <input
                type="text"
                className="armar-input"
                placeholder="Instrucciones para la cuadrilla, prioridad, horario, etc..."
                value={descripcionListado}
                onChange={(e) => setDescripcionListado(e.target.value)}
              />
            </div>

            {/* SELECCIÓN DE MODO: POR RUTA / PERSONALIZADA */}
            <div style={{ marginBottom: "12px" }}>
              <label className="armar-label" style={{ fontSize: "15px" }}>
                ¿Qué usuarios deseas incluir en este listado?
              </label>
              <p style={{ margin: "3px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                Selecciona por ruta completa o arma una lista personalizada eligiendo entre todos los usuarios del sistema con título individual.
              </p>
            </div>

            <div className="armar-modes-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {/* Opción 1: POR RUTA COMPLETA */}
              <div
                className={`armar-mode-card ${modoSeleccion === "ruta" ? "is-active" : ""}`}
                onClick={() => setModoSeleccion("ruta")}
              >
                <input
                  type="radio"
                  name="modoSeleccion"
                  className="armar-mode-radio"
                  checked={modoSeleccion === "ruta"}
                  onChange={() => setModoSeleccion("ruta")}
                />
                <div className="armar-mode-content">
                  <h3>Por Ruta Completa</h3>
                  <p>Asigna todos los usuarios de una ruta específica, con opción de título general o individual.</p>
                  <span className="armar-mode-badge">
                    {rutasDisponibles.length} rutas disponibles
                  </span>
                </div>
              </div>

              {/* Opción 2: SELECCIÓN PERSONALIZADA */}
              <div
                className={`armar-mode-card ${modoSeleccion === "personalizada" ? "is-active" : ""}`}
                onClick={() => setModoSeleccion("personalizada")}
              >
                <input
                  type="radio"
                  name="modoSeleccion"
                  className="armar-mode-radio"
                  checked={modoSeleccion === "personalizada"}
                  onChange={() => setModoSeleccion("personalizada")}
                />
                <div className="armar-mode-content">
                  <h3>Selección Personalizada (Todo el Sistema)</h3>
                  <p>Elige libremente entre todos los usuarios del sistema y asigna un título individual a cada uno.</p>
                  <span className="armar-mode-badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                    {selectedUserIds.length} seleccionados
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-panel si elige POR RUTA */}
            {modoSeleccion === "ruta" && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "20px",
                  marginBottom: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: "260px" }}>
                    <label className="armar-label" style={{ marginBottom: "6px", display: "block" }}>
                      Selecciona la Ruta a asignar:
                    </label>
                    <select
                      className="armar-select"
                      value={rutaSeleccionada}
                      onChange={(e) => setRutaSeleccionada(e.target.value)}
                    >
                      {rutasDisponibles.map((r) => (
                        <option key={r.ruta} value={r.ruta}>
                          Ruta {r.ruta} — ({r.cantidad.toLocaleString()} usuarios)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: "14px", color: "#334155", fontWeight: 700 }}>
                    Total en esta ruta:{" "}
                    <strong style={{ color: "#107c41", fontSize: "17px" }}>
                      {rutasDisponibles.find((r) => r.ruta === rutaSeleccionada)?.cantidad.toLocaleString() || 0} usuarios
                    </strong>
                  </div>
                </div>

                {/* Título o tarea predeterminada para la ruta */}
                <div style={{ background: "#ffffff", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <label className="armar-label" style={{ marginBottom: "6px", display: "block" }}>
                    Título o Tarea Predeterminada para los usuarios de esta ruta (Opcional):
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      className="armar-input"
                      style={{ maxWidth: "320px", padding: "8px 12px", fontSize: "13.5px" }}
                      placeholder="Ej: Inspección, Corte, Reconexión..."
                      value={tituloMasivo}
                      onChange={(e) => setTituloMasivo(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Sugerencias:</span>
                      {sugerenciasTitulos.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          className="armar-pill-btn"
                          onClick={() => setTituloMasivo(sug)}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Opción para personalizar títulos individuales de la ruta */}
                <div>
                  <button
                    type="button"
                    onClick={() => setMostrarPersonalizacionRuta(!mostrarPersonalizacionRuta)}
                    style={{
                      background: mostrarPersonalizacionRuta ? "#0f172a" : "#ffffff",
                      color: mostrarPersonalizacionRuta ? "#ffffff" : "#0f172a",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "10px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{mostrarPersonalizacionRuta ? "▲ Ocultar" : "▼ Personalizar"} títulos individuales por usuario de esta ruta ({usuariosDeRutaSeleccionada.length})</span>
                  </button>
                </div>

                {mostrarPersonalizacionRuta && (
                  <div className="armar-user-table-wrap" style={{ maxHeight: "350px", marginTop: "4px" }}>
                    <table className="armar-user-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>#</th>
                          <th>N° Usuario</th>
                          <th>Titular</th>
                          <th>Domicilio</th>
                          <th style={{ minWidth: "260px" }}>Título Individual para este usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosDeRutaSeleccionada.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                              Cargando usuarios de esta ruta...
                            </td>
                          </tr>
                        ) : (
                          usuariosDeRutaSeleccionada.map((u, idx) => (
                            <tr key={u.id}>
                              <td style={{ color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                              <td style={{ fontWeight: 800 }}>#{u.nroUsuario}</td>
                              <td style={{ fontWeight: 700 }}>{u.nombre}</td>
                              <td>{u.domicilio || "—"}</td>
                              <td>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                  <input
                                    type="text"
                                    className="armar-titulo-indiv-input"
                                    placeholder={tituloMasivo || "Ej: corte, reconexión..."}
                                    value={titulosIndividuales[u.id] || ""}
                                    onChange={(e) => handleSetTituloIndividual(u.id, e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="armar-pill-btn"
                                    onClick={() => handleSetTituloIndividual(u.id, "Corte")}
                                  >
                                    Corte
                                  </button>
                                  <button
                                    type="button"
                                    className="armar-pill-btn"
                                    onClick={() => handleSetTituloIndividual(u.id, "Reconexión")}
                                  >
                                    Reconexión
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-panel si elige SELECCIÓN PERSONALIZADA */}
            {modoSeleccion === "personalizada" && (
              <>
                <div className="armar-user-selector-box">
                  <div style={{ marginBottom: "14px" }}>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                      Elegir entre todos los usuarios del sistema
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                      Busca y selecciona usuarios marcando la casilla. Los usuarios seleccionados se agregarán abajo a la lista armada.
                    </p>
                  </div>

                  <div className="armar-selector-top">
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: 1 }}>
                      <input
                        type="text"
                        className="armar-input"
                        style={{ maxWidth: "340px" }}
                        placeholder="Buscar por n° usuario, nombre, domicilio, medidor..."
                        value={searchUserTerm}
                        onChange={(e) => {
                          setSearchUserTerm(e.target.value);
                          setPaginaSeleccionPersonalizada(1);
                        }}
                      />

                      <select
                        className="armar-select"
                        style={{ maxWidth: "220px" }}
                        value={filtroRutaManual}
                        onChange={(e) => {
                          setFiltroRutaManual(e.target.value);
                          setPaginaSeleccionPersonalizada(1);
                        }}
                      >
                        <option value="todas">Todas las rutas ({totalUsuariosSistema} usuarios)</option>
                        {rutasDisponibles.map((r) => (
                          <option key={r.ruta} value={r.ruta}>
                            Ruta {r.ruta} ({r.cantidad.toLocaleString()} usuarios)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={selectTodosLosFiltrados}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          color: "#334155",
                        }}
                      >
                        Marcar filtrados ({usuariosFiltradosPersonalizada.length})
                      </button>
                      <button
                        type="button"
                        onClick={selectTodosDisponibles}
                        style={{
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          color: "#065f46",
                        }}
                      >
                        Marcar todos ({usuariosDisponibles.length})
                      </button>
                      <button
                        type="button"
                        onClick={deseleccionarTodos}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fecaca",
                          padding: "8px 12px",
                          borderRadius: "10px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          color: "#991b1b",
                        }}
                      >
                        Limpiar ({selectedUserIds.length})
                      </button>
                    </div>
                  </div>

                  {/* Paginación de la tabla de selección */}
                  {totalPaginasSeleccion > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", fontSize: "13px", color: "#64748b" }}>
                      <span>
                        Mostrando {(paginaSeleccionPersonalizada - 1) * USERS_PER_PAGE + 1} a{" "}
                        {Math.min(paginaSeleccionPersonalizada * USERS_PER_PAGE, usuariosFiltradosPersonalizada.length)} de{" "}
                        <strong>{usuariosFiltradosPersonalizada.length.toLocaleString()}</strong> usuarios filtrados
                      </span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={paginaSeleccionPersonalizada <= 1}
                          onClick={() => setPaginaSeleccionPersonalizada((p) => Math.max(1, p - 1))}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: paginaSeleccionPersonalizada <= 1 ? "#f1f5f9" : "#ffffff",
                            cursor: paginaSeleccionPersonalizada <= 1 ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          ← Ant
                        </button>
                        <span style={{ fontWeight: 800, fontSize: "12.5px", color: "#334155" }}>
                          {paginaSeleccionPersonalizada} / {totalPaginasSeleccion}
                        </span>
                        <button
                          type="button"
                          disabled={paginaSeleccionPersonalizada >= totalPaginasSeleccion}
                          onClick={() => setPaginaSeleccionPersonalizada((p) => Math.min(totalPaginasSeleccion, p + 1))}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: paginaSeleccionPersonalizada >= totalPaginasSeleccion ? "#f1f5f9" : "#ffffff",
                            cursor: paginaSeleccionPersonalizada >= totalPaginasSeleccion ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          Sig →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabla de Selección */}
                  <div className="armar-user-table-wrap">
                    <table className="armar-user-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px", textAlign: "center" }}>✓</th>
                          <th>N° Usuario</th>
                          <th>Titular</th>
                          <th>Domicilio</th>
                          <th>Ruta</th>
                          <th>Medidor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuariosPaginadosSeleccion.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                              No se encontraron usuarios coincidentes en el sistema.
                            </td>
                          </tr>
                        ) : (
                          usuariosPaginadosSeleccion.map((u) => {
                            const isSelected = selectedUserIds.includes(u.id);
                            return (
                              <tr
                                key={u.id}
                                className={isSelected ? "is-selected" : ""}
                                onClick={() => toggleSelectUser(u.id)}
                                style={{ cursor: "pointer" }}
                              >
                                <td style={{ textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                  />
                                </td>
                                <td style={{ fontWeight: 800 }}>#{u.nroUsuario}</td>
                                <td style={{ fontWeight: 700 }}>{u.nombre}</td>
                                <td>{u.domicilio || "—"}</td>
                                <td>{u.ruta || "—"}</td>
                                <td style={{ color: "#b45309", fontWeight: 700 }}>{u.medidor || "—"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ==========================================================
                    LISTA ARMADA: USUARIOS SELECCIONADOS Y TÍTULOS INDIVIDUALES
                    ========================================================== */}
                {usuariosSeleccionadosLista.length > 0 && (
                  <div className="armar-lista-armada-card">
                    <div className="armar-lista-armada-header">
                      <div>
                        <h3 className="armar-lista-armada-title">
                          <span>📋 Lista Armada ({usuariosSeleccionadosLista.length} usuarios)</span>
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: "12px",
                              padding: "2px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            Título del listado: {tituloListado || "Sin título aún"}
                          </span>
                        </h3>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#475569" }}>
                          Asigna un título o tarea individual para cada usuario (ej: <strong>corte, reconexión, retiro, inspección...</strong>).
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={deseleccionarTodos}
                          style={{
                            background: "#fee2e2",
                            border: "1px solid #fecaca",
                            color: "#991b1b",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Vaciar lista
                        </button>
                      </div>
                    </div>

                    {/* Barra de Asignación Rápida a Todos */}
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        marginBottom: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                        Aplicar título rápido a todos los seleccionados:
                      </span>
                      <input
                        type="text"
                        className="armar-input"
                        style={{ maxWidth: "200px", padding: "6px 10px", fontSize: "13px" }}
                        placeholder="Ej: Corte, Reconexión..."
                        value={tituloMasivo}
                        onChange={(e) => setTituloMasivo(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleAplicarTituloATodos(tituloMasivo)}
                        style={{
                          background: "#0f172a",
                          color: "#ffffff",
                          border: "none",
                          padding: "7px 14px",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Aplicar a todos
                      </button>

                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Sugerencias:</span>
                        {sugerenciasTitulos.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            className="armar-pill-btn"
                            onClick={() => handleAplicarTituloATodos(sug)}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabla de la Lista Armada con Título Individual */}
                    <div className="armar-user-table-wrap" style={{ maxHeight: "380px" }}>
                      <table className="armar-user-table">
                        <thead>
                          <tr>
                            <th style={{ width: "40px" }}>#</th>
                            <th>N° Usuario</th>
                            <th>Titular</th>
                            <th>Domicilio / Ruta</th>
                            <th style={{ minWidth: "280px" }}>Título Individual para este usuario</th>
                            <th style={{ width: "60px", textAlign: "center" }}>Quitar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usuariosSeleccionadosLista.map((u, idx) => (
                            <tr key={u.id}>
                              <td style={{ color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                              <td style={{ fontWeight: 800 }}>#{u.nroUsuario}</td>
                              <td style={{ fontWeight: 700 }}>{u.nombre}</td>
                              <td>
                                {u.domicilio || "—"}
                                {u.ruta && (
                                  <span style={{ marginLeft: "6px", color: "#0369a1", fontSize: "11px", fontWeight: 700 }}>
                                    (Ruta {u.ruta})
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                  <input
                                    type="text"
                                    className="armar-titulo-indiv-input"
                                    placeholder="Ej: corte, reconexión..."
                                    value={titulosIndividuales[u.id] || ""}
                                    onChange={(e) => handleSetTituloIndividual(u.id, e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="armar-pill-btn"
                                    onClick={() => handleSetTituloIndividual(u.id, "Corte")}
                                  >
                                    Corte
                                  </button>
                                  <button
                                    type="button"
                                    className="armar-pill-btn"
                                    onClick={() => handleSetTituloIndividual(u.id, "Reconexión")}
                                  >
                                    Reconexión
                                  </button>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => quitarUsuarioSeleccionado(u.id)}
                                  title="Quitar de este listado"
                                  style={{
                                    background: "#fee2e2",
                                    border: "1px solid #fecaca",
                                    color: "#991b1b",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                    fontSize: "13px",
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Banner resumen antes de enviar */}
            <div
              style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                border: "1.5px solid #86efac",
                borderRadius: "14px",
                padding: "16px 22px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#065f46" }}>
                  Resumen de Asignación
                </div>
                <div style={{ fontSize: "13.5px", color: "#166534", marginTop: "4px" }}>
                  Listado: <strong>"{tituloListado || "Sin título aún"}"</strong> → Cuadrilla:{" "}
                  <strong>{cuadrillaSeleccionadaObj?.nombre || "No seleccionada"}</strong>
                </div>
              </div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "#0b5c30" }}>
                Total a incluir: {cantidadUsuariosEstimada.toLocaleString()} usuarios
              </div>
            </div>

            {/* Botón de Envío */}
            <div style={{ textAlign: "right" }}>
              <button
                type="submit"
                disabled={enviando || cantidadUsuariosEstimada === 0 || !tituloListado.trim()}
                className="armar-btn-submit"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>
                  {enviando
                    ? "Creando y enviando listado..."
                    : `Crear y Enviar Listado (${cantidadUsuariosEstimada.toLocaleString()} usuarios)`}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ==========================================================
            PESTAÑA 2: MONITOREO EN VIVO DE LISTADOS
            ========================================================== */}
        {activeTab === "monitoreo" && (
          <div>
            <div className="monitoreo-live-bar">
              <div className="monitoreo-live-badge">
                <span className="monitoreo-pulse-dot" />
                <span>Monitoreo en Vivo de Cuadrillas</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#64748b" }}>
                <span>Actualizado: {ultimaActualizacion.toLocaleTimeString()}</span>
                <button
                  type="button"
                  onClick={() => fetchListados(false)}
                  disabled={actualizandoEnVivo}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  {actualizandoEnVivo ? "Actualizando..." : "Refrescar ahora"}
                </button>
              </div>
            </div>

            {/* Filtros de Pestañas de Monitoreo */}
            {listadosActivos.length > 0 && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "18px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setFiltroListadosTab("todos")}
                  style={{
                    background: filtroListadosTab === "todos" ? "#0f172a" : "#f1f5f9",
                    color: filtroListadosTab === "todos" ? "#ffffff" : "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "7px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Todos ({listadosActivos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroListadosTab("completados")}
                  style={{
                    background: filtroListadosTab === "completados" ? "#15803d" : "#ecfdf5",
                    color: filtroListadosTab === "completados" ? "#ffffff" : "#166534",
                    border: "1.5px solid #86efac",
                    padding: "7px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>✓ Completados por Cuadrilla</span>
                  <span
                    style={{
                      background: filtroListadosTab === "completados" ? "#ffffff" : "#15803d",
                      color: filtroListadosTab === "completados" ? "#15803d" : "#ffffff",
                      fontSize: "11px",
                      padding: "1px 6px",
                      borderRadius: "8px",
                      fontWeight: 800,
                    }}
                  >
                    {listadosActivos.filter((l) => l.completado && !l.terminado).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroListadosTab("en_progreso")}
                  style={{
                    background: filtroListadosTab === "en_progreso" ? "#0284c7" : "#f0f9ff",
                    color: filtroListadosTab === "en_progreso" ? "#ffffff" : "#0369a1",
                    border: "1px solid #bae6fd",
                    padding: "7px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  En progreso ({listadosActivos.filter((l) => !l.completado && !l.terminado).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroListadosTab("terminados")}
                  style={{
                    background: filtroListadosTab === "terminados" ? "#475569" : "#f1f5f9",
                    color: filtroListadosTab === "terminados" ? "#ffffff" : "#64748b",
                    border: "1px solid #cbd5e1",
                    padding: "7px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Dados por terminado ({listadosActivos.filter((l) => l.terminado).length})
                </button>
              </div>
            )}

            {listadosActivos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                <p style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                  Aún no hay listados armados en el sistema
                </p>
                <p style={{ fontSize: "14px", margin: 0 }}>
                  Ve a la pestaña "Armar Nuevo Listado" para crear el primero y asignárselo a una cuadrilla.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {listadosActivos
                  .filter((l) => {
                    if (filtroListadosTab === "completados") return !!l.completado && !l.terminado;
                    if (filtroListadosTab === "en_progreso") return !l.completado && !l.terminado;
                    if (filtroListadosTab === "terminados") return !!l.terminado;
                    return true;
                  })
                  .map((listado) => {
                  const isExpanded = !!listadosExpandidos[listado.id];
                  const qBusqueda = (busquedaMonitoreo[listado.id] || "").trim().toLowerCase();
                  const filtroEstado = filtroEstadoMonitoreo[listado.id] || "todos";
                  const pagina = paginaMonitoreo[listado.id] || 1;
                  const ITEMS_PER_PAGE = 40;

                  // Filtrar items para el acordeón
                  const itemsFiltrados = listado.items.filter((it) => {
                    if (filtroEstado === "completados" && !it.completado) return false;
                    if (filtroEstado === "pendientes" && it.completado) return false;
                    if (!qBusqueda) return true;
                    const nro = (it.usuario.nroUsuario || "").toLowerCase();
                    const nom = (it.usuario.nombre || "").toLowerCase();
                    const dom = (it.usuario.domicilio || "").toLowerCase();
                    return nro.includes(qBusqueda) || nom.includes(qBusqueda) || dom.includes(qBusqueda);
                  });

                  const totalPaginas = Math.ceil(itemsFiltrados.length / ITEMS_PER_PAGE) || 1;
                  const itemsPaginados = itemsFiltrados.slice(
                    (pagina - 1) * ITEMS_PER_PAGE,
                    pagina * ITEMS_PER_PAGE
                  );

                  return (
                    <div
                      key={listado.id}
                      className="listado-card"
                      style={{
                        border: listado.completado && !listado.terminado
                          ? "2px solid #86efac"
                          : listado.terminado
                          ? "1.5px solid #cbd5e1"
                          : undefined,
                        background: listado.completado && !listado.terminado
                          ? "linear-gradient(180deg, #f0fdf4 0%, #ffffff 70px)"
                          : listado.terminado
                          ? "#f8fafc"
                          : undefined,
                      }}
                    >
                      <div className="listado-card-top">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                            <h2 className="listado-card-title" style={{ margin: 0 }}>{listado.titulo}</h2>
                            {listado.completado && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  background: "#dcfce7",
                                  color: "#166534",
                                  border: "1.5px solid #86efac",
                                  padding: "3px 10px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                }}
                              >
                                ✓ COMPLETADO POR LA CUADRILLA
                                {listado.fechaCompletado && (
                                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#15803d" }}>
                                    ({new Date(listado.fechaCompletado).toLocaleDateString()} {new Date(listado.fechaCompletado).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                                  </span>
                                )}
                              </span>
                            )}
                            {listado.terminado && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  background: "#e2e8f0",
                                  color: "#334155",
                                  border: "1px solid #cbd5e1",
                                  padding: "3px 10px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                }}
                              >
                                🔒 DADO POR TERMINADO
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                            <span className="listado-card-cuadrilla">
                              Cuadrilla: {listado.cuadrilla.nombre}
                            </span>
                            <span style={{ fontSize: "12.5px", color: "#64748b" }}>
                              Creado: {new Date(listado.createdAt).toLocaleDateString()} a las{" "}
                              {new Date(listado.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => toggleExpandirListado(listado.id)}
                            style={{
                              background: isExpanded ? "#0f172a" : "#f1f5f9",
                              color: isExpanded ? "#ffffff" : "#334155",
                              border: "1px solid #cbd5e1",
                              padding: "8px 16px",
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isExpanded ? "Ocultar usuarios" : `Ver ${listado.items.length.toLocaleString()} usuarios`}
                          </button>

                          {/* Botón Dar por Terminado / Reabrir */}
                          <button
                            type="button"
                            onClick={() => handleToggleTerminadoListado(listado.id, listado.titulo, !!listado.terminado)}
                            style={{
                              background: listado.terminado ? "#f1f5f9" : "#0284c7",
                              color: listado.terminado ? "#0369a1" : "#ffffff",
                              border: listado.terminado ? "1px solid #cbd5e1" : "none",
                              padding: "8px 14px",
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                            title={listado.terminado ? "Reabrir listado" : "Dar por terminado este listado"}
                          >
                            {listado.terminado ? "↩️ Reabrir" : "✓ Dar por Terminado"}
                          </button>

                          {/* Botón Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleEliminarListado(listado.id, listado.titulo)}
                            style={{
                              background: "#fee2e2",
                              color: "#991b1b",
                              border: "1px solid #fecaca",
                              padding: "8px 14px",
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            title="Eliminar listado"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {listado.descripcion && (
                        <p style={{ margin: "0 0 12px 0", fontSize: "13.5px", color: "#475569" }}>
                          {listado.descripcion}
                        </p>
                      )}

                      {/* Progreso */}
                      <div className="listado-progress-wrap">
                        <div className="listado-progress-labels">
                          <span>
                            Avance: <strong>{listado.stats.completados.toLocaleString()}</strong> de{" "}
                            <strong>{listado.stats.total.toLocaleString()}</strong> usuarios inspeccionados
                          </span>
                          <span style={{ color: "#107c41" }}>{listado.stats.porcentaje}% completado</span>
                        </div>
                        <div className="listado-progress-bar">
                          <div
                            className="listado-progress-fill"
                            style={{ width: `${listado.stats.porcentaje}%` }}
                          />
                        </div>
                      </div>

                      {/* Detalle Desplegable con Búsqueda y Paginación */}
                      {isExpanded && (
                        <div className="listado-items-accordion">
                          {/* Filtros del Acordeón */}
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "12px",
                              flexWrap: "wrap",
                            }}
                          >
                            <input
                              type="text"
                              className="armar-input"
                              style={{ maxWidth: "320px", padding: "8px 12px", fontSize: "13px" }}
                              placeholder="Buscar en este listado por número o titular..."
                              value={busquedaMonitoreo[listado.id] || ""}
                              onChange={(e) => {
                                setBusquedaMonitoreo((prev) => ({ ...prev, [listado.id]: e.target.value }));
                                setPaginaMonitoreo((prev) => ({ ...prev, [listado.id]: 1 }));
                              }}
                            />

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <select
                                className="armar-select"
                                style={{ width: "auto", padding: "8px 12px", fontSize: "13px" }}
                                value={filtroEstadoMonitoreo[listado.id] || "todos"}
                                onChange={(e) => {
                                  setFiltroEstadoMonitoreo((prev) => ({
                                    ...prev,
                                    [listado.id]: e.target.value as any,
                                  }));
                                  setPaginaMonitoreo((prev) => ({ ...prev, [listado.id]: 1 }));
                                }}
                              >
                                <option value="todos">Todos ({listado.items.length})</option>
                                <option value="pendientes">Pendientes ({listado.stats.pendientes})</option>
                                <option value="completados">Completados ({listado.stats.completados})</option>
                              </select>

                              {/* Paginación */}
                              {totalPaginas > 1 && (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    type="button"
                                    disabled={pagina <= 1}
                                    onClick={() =>
                                      setPaginaMonitoreo((prev) => ({ ...prev, [listado.id]: pagina - 1 }))
                                    }
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      border: "1px solid #cbd5e1",
                                      background: pagina <= 1 ? "#f1f5f9" : "#ffffff",
                                      cursor: pagina <= 1 ? "not-allowed" : "pointer",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    ← Ant
                                  </button>
                                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#475569" }}>
                                    {pagina} / {totalPaginas}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={pagina >= totalPaginas}
                                    onClick={() =>
                                      setPaginaMonitoreo((prev) => ({ ...prev, [listado.id]: pagina + 1 }))
                                    }
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      border: "1px solid #cbd5e1",
                                      background: pagina >= totalPaginas ? "#f1f5f9" : "#ffffff",
                                      cursor: pagina >= totalPaginas ? "not-allowed" : "pointer",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Sig →
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="armar-user-table-wrap">
                            <table className="armar-user-table">
                              <thead>
                                <tr>
                                  <th style={{ width: "40px" }}>#</th>
                                  <th>N° Usuario</th>
                                  <th>Titular</th>
                                  <th>Domicilio</th>
                                  <th>Ruta</th>
                                  <th>Título / Tarea</th>
                                  <th>Estado en Vivo</th>
                                  <th style={{ textAlign: "right" }}>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsPaginados.length === 0 ? (
                                  <tr>
                                    <td colSpan={8} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                                      No se encontraron usuarios con ese filtro en este listado.
                                    </td>
                                  </tr>
                                ) : (
                                  itemsPaginados.map((it, idx) => {
                                    const numeroFila = (pagina - 1) * ITEMS_PER_PAGE + idx + 1;
                                    const fichaUrl = `/ficha/${encodeURIComponent(it.usuario.nroUsuario || String(it.usuario.id))}`;
                                    return (
                                      <tr
                                        key={it.id}
                                        style={{
                                          background: it.completado ? "#f8fafc" : "#ffffff",
                                          opacity: it.completado ? 0.75 : 1,
                                        }}
                                      >
                                        <td style={{ color: "#94a3b8", fontWeight: 700 }}>
                                          {numeroFila}
                                        </td>
                                        <td style={{ fontWeight: 800 }}>
                                          #{it.usuario.nroUsuario || it.usuario.id}
                                        </td>
                                        <td style={{ fontWeight: 700, color: it.completado ? "#64748b" : "#0f172a" }}>
                                          {it.usuario.nombre || "Sin Nombre"}
                                        </td>
                                        <td>{it.usuario.domicilio || "—"}</td>
                                        <td>{it.usuario.ruta || "—"}</td>
                                        <td>
                                          {it.titulo ? (
                                            <span className="armar-badge-titulo">
                                              ⚡ {it.titulo}
                                            </span>
                                          ) : (
                                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                                          )}
                                        </td>
                                        <td>
                                          {it.completado ? (
                                            <span
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                background: "#dcfce7",
                                                color: "#166534",
                                                padding: "3px 8px",
                                                borderRadius: "6px",
                                                fontSize: "12px",
                                                fontWeight: 800,
                                              }}
                                            >
                                              ✓ Completado
                                            </span>
                                          ) : (
                                            <span
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                background: "#fef3c7",
                                                color: "#92400e",
                                                padding: "3px 8px",
                                                borderRadius: "6px",
                                                fontSize: "12px",
                                                fontWeight: 800,
                                              }}
                                            >
                                              ⏳ Pendiente
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                          <button
                                            type="button"
                                            onClick={() => handleEditarTituloItem(it.id, it.titulo || "", it.usuario.nombre)}
                                            style={{
                                              background: "#eff6ff",
                                              border: "1px solid #bfdbfe",
                                              padding: "5px 9px",
                                              borderRadius: "6px",
                                              fontSize: "12px",
                                              fontWeight: 700,
                                              cursor: "pointer",
                                              marginRight: "6px",
                                              color: "#1d4ed8",
                                            }}
                                            title="Editar título individual asignado a este usuario"
                                          >
                                            ✏️ Título
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleItemAdmin(it.id, it.completado)}
                                            style={{
                                              background: it.completado ? "#e2e8f0" : "#dcfce7",
                                              border: "1px solid #cbd5e1",
                                              padding: "5px 10px",
                                              borderRadius: "6px",
                                              fontSize: "12px",
                                              fontWeight: 700,
                                              cursor: "pointer",
                                              marginRight: "6px",
                                              color: it.completado ? "#475569" : "#166534",
                                            }}
                                          >
                                            {it.completado ? "Desmarcar" : "Completar"}
                                          </button>
                                          <Link
                                            href={fichaUrl}
                                            target="_blank"
                                            style={{
                                              display: "inline-block",
                                              background: "#0f172a",
                                              color: "#ffffff",
                                              padding: "5px 10px",
                                              borderRadius: "6px",
                                              fontSize: "12px",
                                              fontWeight: 700,
                                              textDecoration: "none",
                                            }}
                                          >
                                            Ver Ficha ↗
                                          </Link>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
