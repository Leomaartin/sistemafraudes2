"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import "../css/cuadrillaListado.css";

export interface UsuarioItem {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio?: string | null;
  medidor?: string | null;
  ruta?: string | null;
  completado?: boolean;
}

export interface ListadoItemType {
  id: number;
  idListado: number;
  idUsuario: number;
  orden: number;
  titulo?: string | null;
  completado: boolean;
  fechaCompletado?: string | null;
  usuario: UsuarioItem;
}

export interface ListadoCuadrillaType {
  id: number;
  titulo: string;
  descripcion?: string | null;
  idCuadrilla: number;
  completado?: boolean;
  fechaCompletado?: string | null;
  terminado?: boolean;
  fechaTerminado?: string | null;
  createdAt: string;
  items: ListadoItemType[];
  stats?: {
    total: number;
    completados: number;
    pendientes: number;
    porcentaje: number;
  };
}

interface VistaCuadrillaProps {
  currentUser: {
    email?: string;
    name?: string;
    role?: string;
    esAdmin?: boolean;
    cuadrillaNombre?: string | null;
    cuadrillaId?: number | null;
  } | null;
  usuarios: UsuarioItem[];
  cargando: boolean;
  onRefresh: () => void;
}

export default function VistaCuadrilla({
  currentUser,
  usuarios,
  cargando: cargandoGeneral,
  onRefresh,
}: VistaCuadrillaProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendientes" | "completados">("todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const [listados, setListados] = useState<ListadoCuadrillaType[]>([]);
  const [cargandoListados, setCargandoListados] = useState(false);
  const [selectedListadoId, setSelectedListadoId] = useState<number | "todos">("todos");
  const [actualizandoListado, setActualizandoListado] = useState(false);

  // Clave: idUsuario -> estado completado
  const [completadosMap, setCompletadosMap] = useState<Record<number, boolean>>({});

  const ITEMS_PER_PAGE = 40;

  // Cargar listados asignados a esta cuadrilla
  const fetchListados = useCallback(async () => {
    setCargandoListados(true);
    try {
      const res = await fetch("/api/listados");
      if (res.ok) {
        const data: ListadoCuadrillaType[] = await res.json();
        setListados(data);
        if (data.length > 0 && selectedListadoId === "todos") {
          setSelectedListadoId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error al cargar listados:", err);
    } finally {
      setCargandoListados(false);
    }
  }, [selectedListadoId]);

  useEffect(() => {
    fetchListados();
  }, []);

  const handleRefreshAll = () => {
    onRefresh();
    fetchListados();
  };

  // Listado activo
  const activeListado = useMemo(() => {
    if (selectedListadoId === "todos") return null;
    return listados.find((l) => l.id === selectedListadoId) || null;
  }, [listados, selectedListadoId]);

  // Lista base según listado activo o todos los asignados
  const displayUsuarios = useMemo(() => {
    if (activeListado) {
      return activeListado.items.map((it) => ({
        ...it.usuario,
        tituloIndividual: it.titulo,
        completado: it.completado,
        _itemId: it.id,
        _idListado: activeListado.id,
      }));
    }
    return usuarios.map((u) => ({
      ...u,
      tituloIndividual: undefined,
      _itemId: undefined,
      _idListado: undefined,
    }));
  }, [activeListado, usuarios]);

  // Alternar estado completado con la API sincronizada
  const handleToggleCompletado = async (
    idUsuario: number,
    estadoActual: boolean,
    itemId?: number,
    idListado?: number
  ) => {
    const nuevoEstado = !estadoActual;
    setCompletadosMap((prev) => ({ ...prev, [idUsuario]: nuevoEstado }));

    if (idListado) {
      setListados((prev) =>
        prev.map((l) => {
          if (l.id !== idListado) return l;
          const updatedItems = l.items.map((it) =>
            it.idUsuario === idUsuario ? { ...it, completado: nuevoEstado } : it
          );
          const total = updatedItems.length;
          const completados = updatedItems.filter((i) => i.completado).length;
          return {
            ...l,
            items: updatedItems,
            stats: {
              total,
              completados,
              pendientes: total - completados,
              porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0,
            },
          };
        })
      );
    }

    try {
      if (idListado) {
        const res = await fetch("/api/listados/item", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId,
            idListado,
            idUsuario,
            completado: nuevoEstado,
          }),
        });
        if (!res.ok) throw new Error("Error en servidor");
      } else {
        const res = await fetch("/api/usuarios/completado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: idUsuario, completado: nuevoEstado }),
        });
        if (!res.ok) throw new Error("Error en servidor");
      }
    } catch (err) {
      console.error("Error al actualizar estado completado:", err);
      setCompletadosMap((prev) => ({ ...prev, [idUsuario]: estadoActual }));
      fetchListados();
    }
  };

  // Alternar estado completado de la lista entera desde la cuadrilla
  const handleToggleListadoCompletado = async (listadoId: number, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    const confirmMsg = nuevoEstado
      ? "¿Confirmas que tu cuadrilla ha COMPLETADO esta lista de trabajo?\n\nAl marcarla como completada, le aparecerá como finalizada a quien la creó para que pueda darla por terminada o eliminarla."
      : "¿Deseas desmarcar esta lista como completada y volver a ponerla en curso?";
    if (!window.confirm(confirmMsg)) return;

    setActualizandoListado(true);
    try {
      const res = await fetch("/api/listados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idListado: listadoId, completado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar estado");
      // Actualizar listados localmente
      setListados((prev) =>
        prev.map((l) =>
          l.id === listadoId
            ? {
                ...l,
                completado: nuevoEstado,
                fechaCompletado: nuevoEstado ? new Date().toISOString() : null,
              }
            : l
        )
      );
    } catch (err: any) {
      console.error("Error:", err);
      alert(err.message || "No se pudo actualizar el estado de la lista.");
    } finally {
      setActualizandoListado(false);
    }
  };

  // Filtrado por texto y por estado (todos / pendientes / completados)
  const usuariosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return displayUsuarios.filter((u) => {
      const isCompletado =
        completadosMap[u.id] !== undefined ? completadosMap[u.id] : !!u.completado;

      if (filtroEstado === "completados" && !isCompletado) return false;
      if (filtroEstado === "pendientes" && isCompletado) return false;

      if (!term) return true;
      const nro = (u.nroUsuario || "").toLowerCase();
      const nom = (u.nombre || "").toLowerCase();
      const dom = (u.domicilio || "").toLowerCase();
      const rut = (u.ruta || "").toLowerCase();
      return nro.includes(term) || nom.includes(term) || dom.includes(term) || rut.includes(term);
    });
  }, [displayUsuarios, searchTerm, filtroEstado, completadosMap]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [searchTerm, filtroEstado, selectedListadoId]);

  // Paginación
  const totalPaginas = Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE) || 1;
  const usuariosPaginados = useMemo(() => {
    const start = (paginaActual - 1) * ITEMS_PER_PAGE;
    return usuariosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [usuariosFiltrados, paginaActual]);

  // Contar cuántos completados hay en el listado activo
  const totalCompletados = useMemo(() => {
    return displayUsuarios.filter((u) => {
      return completadosMap[u.id] !== undefined ? completadosMap[u.id] : !!u.completado;
    }).length;
  }, [displayUsuarios, completadosMap]);

  const porcentajeProgreso =
    displayUsuarios.length > 0
      ? Math.round((totalCompletados / displayUsuarios.length) * 100)
      : 0;

  return (
    <div className="cuadrilla-view-container">
      <div className="cuadrilla-main-card">
        {/* Cabecera */}
        <div className="cuadrilla-header-bar">
          <div className="cuadrilla-title-block">
            <h1>Hoja de Ruta de Inspección</h1>
            <div className="cuadrilla-subtitle">
              <span>Cuadrilla:</span>
              <strong>{currentUser?.cuadrillaNombre || "Asignada"}</strong>
            </div>
          </div>

          <div className="cuadrilla-header-actions">
            <button
              onClick={handleRefreshAll}
              className="cuadrilla-btn-header"
              title="Actualizar lista"
              disabled={cargandoGeneral || cargandoListados}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              <span>Actualizar</span>
            </button>
            <a
              href="/api/auth/logout"
              className="cuadrilla-btn-header cuadrilla-btn-logout"
              title="Cerrar sesión"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Salir</span>
            </a>
          </div>
        </div>

        {/* Selector de Listados asignados */}
        {listados.length > 0 && (
          <div className="cuadrilla-listados-nav">
            <span style={{ fontSize: "12.5px", fontWeight: 800, color: "#64748b", marginRight: "4px" }}>
              LISTADOS:
            </span>
            {listados.map((l) => {
              const isActive = selectedListadoId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedListadoId(l.id)}
                  className={`cuadrilla-listado-tab ${isActive ? "active" : ""}`}
                  style={{
                    borderColor: l.completado ? "#86efac" : undefined,
                    background: isActive ? undefined : l.completado ? "#f0fdf4" : undefined,
                  }}
                >
                  {l.completado && <span style={{ color: "#16a34a", fontWeight: 900 }}>✓</span>}
                  <span>{l.titulo}</span>
                  <span
                    className="cuadrilla-tab-badge"
                    style={{
                      background: l.completado ? "#16a34a" : undefined,
                      color: l.completado ? "#ffffff" : undefined,
                    }}
                  >
                    {l.stats ? `${l.stats.completados}/${l.stats.total}` : `${l.items.length}`}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSelectedListadoId("todos")}
              className={`cuadrilla-listado-tab ${selectedListadoId === "todos" ? "active" : ""}`}
            >
              <span>Todos los Usuarios</span>
              <span className="cuadrilla-tab-badge">{usuarios.length}</span>
            </button>
          </div>
        )}

        {/* Banner de Listado Activo */}
        {activeListado && (
          <div
            className="cuadrilla-banner-listado"
            style={{
              borderColor: activeListado.completado ? "#86efac" : undefined,
              background: activeListado.completado
                ? "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)"
                : undefined,
            }}
          >
            <div className="cuadrilla-banner-top">
              <h2 className="cuadrilla-banner-title">
                <span
                  className="cuadrilla-banner-tag"
                  style={{
                    background: activeListado.completado ? "#15803d" : undefined,
                  }}
                >
                  {activeListado.completado ? "✓ Listado Completado" : "Listado Asignado"}
                </span>
                <span>{activeListado.titulo}</span>
              </h2>
              <div className="cuadrilla-banner-stats">
                Progreso: <strong>{totalCompletados.toLocaleString()}</strong> de{" "}
                <strong>{displayUsuarios.length.toLocaleString()}</strong> completados ({porcentajeProgreso}%)
              </div>
            </div>
            {activeListado.descripcion && (
              <p style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "#475569" }}>
                {activeListado.descripcion}
              </p>
            )}
            <div className="cuadrilla-banner-progress-wrap">
              <div
                className="cuadrilla-banner-progress-bar"
                style={{
                  width: `${porcentajeProgreso}%`,
                  background: activeListado.completado
                    ? "linear-gradient(90deg, #16a34a, #22c55e)"
                    : undefined,
                }}
              />
            </div>

            {/* Barra de Estado y Botón de Marcar Lista Completada */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid #e2e8f0",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {activeListado.completado ? (
                  <span
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      border: "1.5px solid #86efac",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    ✓ LISTA MARCADA COMO COMPLETADA
                    {activeListado.fechaCompletado && (
                      <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#15803d" }}>
                        ({new Date(activeListado.fechaCompletado).toLocaleDateString()} {new Date(activeListado.fechaCompletado).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                      </span>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                    Estado actual: En progreso
                  </span>
                )}
                {activeListado.terminado && (
                  <span
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    🔒 DADO POR TERMINADO
                  </span>
                )}
              </div>

              <div>
                <button
                  type="button"
                  disabled={actualizandoListado}
                  onClick={() => handleToggleListadoCompletado(activeListado.id, !!activeListado.completado)}
                  style={{
                    background: activeListado.completado ? "#f8fafc" : "#107c41",
                    color: activeListado.completado ? "#334155" : "#ffffff",
                    border: activeListado.completado ? "1.5px solid #cbd5e1" : "none",
                    padding: "9px 18px",
                    borderRadius: "10px",
                    fontSize: "13.5px",
                    fontWeight: 800,
                    cursor: actualizandoListado ? "wait" : "pointer",
                    boxShadow: activeListado.completado ? "none" : "0 4px 14px rgba(16, 124, 65, 0.3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    {actualizandoListado
                      ? "Actualizando..."
                      : activeListado.completado
                      ? "Desmarcar Lista Completada"
                      : "Marcar Lista como Completada"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filtros: Buscador + Filtro Estado */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
          <div className="cuadrilla-search-box" style={{ flex: 1, minWidth: "260px", marginBottom: 0 }}>
            <span className="cuadrilla-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className="cuadrilla-search-input"
              placeholder="Buscar por n° usuario, nombre o domicilio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="cuadrilla-search-clear"
                onClick={() => setSearchTerm("")}
                title="Borrar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setFiltroEstado("todos")}
              className={`cuadrilla-listado-tab ${filtroEstado === "todos" ? "active" : ""}`}
              style={{ padding: "10px 14px", fontSize: "13px" }}
            >
              Todos ({displayUsuarios.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("pendientes")}
              className={`cuadrilla-listado-tab ${filtroEstado === "pendientes" ? "active" : ""}`}
              style={{ padding: "10px 14px", fontSize: "13px" }}
            >
              Pendientes ({displayUsuarios.length - totalCompletados})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado("completados")}
              className={`cuadrilla-listado-tab ${filtroEstado === "completados" ? "active" : ""}`}
              style={{ padding: "10px 14px", fontSize: "13px" }}
            >
              Completados ({totalCompletados})
            </button>
          </div>
        </div>

        {/* Barra de Conteo y Paginación superior */}
        <div className="cuadrilla-counter-bar">
          <div>
            Mostrando <strong>{usuariosPaginados.length}</strong> de{" "}
            <strong>{usuariosFiltrados.length.toLocaleString()}</strong> encontrados
            {totalCompletados > 0 && (
              <span style={{ marginLeft: "14px", color: "#107c41", fontWeight: 700 }}>
                • {totalCompletados.toLocaleString()} completados en total ({porcentajeProgreso}%)
              </span>
            )}
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                disabled={paginaActual <= 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                style={{
                  background: paginaActual <= 1 ? "#f1f5f9" : "#ffffff",
                  border: "1px solid #cbd5e1",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: paginaActual <= 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Ant
              </button>
              <span style={{ fontSize: "12.5px", fontWeight: 800 }}>
                {paginaActual} / {totalPaginas}
              </span>
              <button
                type="button"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                style={{
                  background: paginaActual >= totalPaginas ? "#f1f5f9" : "#ffffff",
                  border: "1px solid #cbd5e1",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: paginaActual >= totalPaginas ? "not-allowed" : "pointer",
                }}
              >
                Sig →
              </button>
            </div>
          )}
        </div>

        {/* Listado de Filas */}
        <div className="cuadrilla-list-wrap">
          {usuariosPaginados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                {displayUsuarios.length === 0
                  ? "No hay usuarios en este listado"
                  : "No se encontraron coincidencias"}
              </div>
              <p style={{ fontSize: "14px", margin: 0 }}>
                {displayUsuarios.length === 0
                  ? "El administrador asignará suministros o listados para tu cuadrilla aquí."
                  : `Ningún usuario coincide con los filtros aplicados.`}
              </p>
            </div>
          ) : (
            usuariosPaginados.map((u) => {
              const isCompletado =
                completadosMap[u.id] !== undefined
                  ? completadosMap[u.id]
                  : !!u.completado;
              const fichaUrl = `/ficha/${encodeURIComponent(u.nroUsuario || String(u.id))}`;

              return (
                <div
                  key={u.id}
                  className={`cuadrilla-list-item ${isCompletado ? "is-completado" : ""}`}
                >
                  <div className="cuadrilla-item-info">
                    <span className="cuadrilla-item-nro">
                      Usuario #{u.nroUsuario || u.id}
                    </span>
                    {(u as any).tituloIndividual && (
                      <span className="cuadrilla-badge-titulo-individual" title="Tarea o título asignado a este usuario">
                        📋 {(u as any).tituloIndividual}
                      </span>
                    )}
                    <h2 className="cuadrilla-item-nombre">
                      {u.nombre || "Sin Nombre de Titular"}
                    </h2>
                    {u.domicilio && (
                      <span style={{ fontSize: "13.5px", color: "#64748b", fontWeight: 600 }}>
                        {u.domicilio}
                      </span>
                    )}
                    {u.ruta && (
                      <span style={{ fontSize: "12px", color: "#0369a1", background: "#e0f2fe", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        Ruta {u.ruta}
                      </span>
                    )}
                    {isCompletado && (
                      <span className="cuadrilla-badge-completado">
                        Completado
                      </span>
                    )}
                  </div>

                  <div className="cuadrilla-item-actions">
                    {/* Botón de Completado */}
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleCompletado(u.id, isCompletado, (u as any)._itemId, (u as any)._idListado)
                      }
                      className={`cuadrilla-btn-completar ${isCompletado ? "is-active" : ""}`}
                      title={
                        isCompletado
                          ? "Desmarcar para volver a poner como pendiente"
                          : "Marcar usuario como completado"
                      }
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {isCompletado ? (
                          <path d="M20 6 9 17l-5-5" />
                        ) : (
                          <circle cx="12" cy="12" r="9" />
                        )}
                      </svg>
                      <span>{isCompletado ? "Completado" : "Completar"}</span>
                    </button>

                    {/* Botón Abrir Ficha */}
                    <Link href={fichaUrl} className="cuadrilla-btn-abrir-ficha">
                      <span>Abrir Ficha</span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginación Inferior */}
        {totalPaginas > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1.5px solid #f1f5f9",
            }}
          >
            <button
              type="button"
              disabled={paginaActual <= 1}
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              className="cuadrilla-btn-header"
              style={{ opacity: paginaActual <= 1 ? 0.5 : 1 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#334155" }}>
              Página {paginaActual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              className="cuadrilla-btn-header"
              style={{ opacity: paginaActual >= totalPaginas ? 0.5 : 1 }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
