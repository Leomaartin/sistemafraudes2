"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import "../css/estadisticas.css";

interface EstadoStat {
  id: number;
  nombre: string;
  totalUsuarios: number;
  totalDeptos: number;
  conGeo: number;
  sinGeo: number;
  porcentajeDelTotal: number;
  esFraude: boolean;
  colorInfo: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    colorName: string;
    emoji?: string;
  };
}

interface TarifaStat {
  id: number;
  nombre: string;
  totalUsuarios: number;
  totalFraudes: number;
  tasaFraude: number;
  porcentajeDelTotal: number;
  conGeo: number;
  sinGeo: number;
  nivelRiesgo: "Alto" | "Medio" | "Bajo";
}

interface CuadrillaStat {
  id: number;
  nombre: string;
  totalUsuarios: number;
  totalFraudes: number;
  tasaFraude: number;
  porcentajeDelTotal: number;
  conGeo: number;
  sinGeo: number;
  desgloseEstados: Record<string, number>;
}

interface MetricasResponse {
  globales: {
    totalUsuarios: number;
    totalFraudes: number;
    tasaFraudeGlobal: number;
    conGeo: number;
    sinGeo: number;
    porcentajeGeo: number;
    totalEstados: number;
    totalTarifas: number;
    totalCuadrillas: number;
    usuariosEnCuadrillas: number;
    usuariosSinCuadrilla: number;
    porcentajeAsignadoCuadrillas: number;
  };
  estados: EstadoStat[];
  tarifas: TarifaStat[];
  cuadrillas: CuadrillaStat[];
  actualizadoEl: string;
}

export default function EstadisticasSistemaPage() {
  const [data, setData] = useState<MetricasResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pestaña activa: ESTADOS | TARIFAS | CUADRILLAS | RESUMEN
  const [vistaActiva, setVistaActiva] = useState<"ESTADOS" | "TARIFAS" | "CUADRILLAS" | "RESUMEN">("ESTADOS");

  // Filtros comunes
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroTipoEstado, setFiltroTipoEstado] = useState<"TODOS" | "FRAUDE" | "REGULAR">("TODOS");
  const [filtroRiesgoTarifa, setFiltroRiesgoTarifa] = useState<"TODOS" | "Alto" | "Medio" | "Bajo">("TODOS");
  const [criterioOrden, setCriterioOrden] = useState<"volumen" | "fraudes" | "tasa" | "nombre">("volumen");

  const cargarMetricas = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await fetch("/api/metricas-sistema", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al obtener las métricas del sistema");
      const json: MetricasResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError("No se pudieron cargar las métricas. Verifica la conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMetricas();
  }, [cargarMetricas]);

  // Lista procesada de ESTADOS
  const estadosProcesados = useMemo(() => {
    if (!data?.estados) return [];
    let filtrados = data.estados;

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase().trim();
      filtrados = filtrados.filter((e) => e.nombre.toLowerCase().includes(q));
    }

    if (filtroTipoEstado === "FRAUDE") {
      filtrados = filtrados.filter((e) => e.esFraude);
    } else if (filtroTipoEstado === "REGULAR") {
      filtrados = filtrados.filter((e) => !e.esFraude);
    }

    const copia = [...filtrados];
    switch (criterioOrden) {
      case "volumen":
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
      case "fraudes":
        return copia.sort((a, b) => (b.esFraude ? 1 : 0) - (a.esFraude ? 1 : 0) || b.totalUsuarios - a.totalUsuarios);
      case "nombre":
        return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
      default:
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
    }
  }, [data, filtroTexto, filtroTipoEstado, criterioOrden]);

  // Lista procesada de TARIFAS
  const tarifasProcesadas = useMemo(() => {
    if (!data?.tarifas) return [];
    let filtradas = data.tarifas;

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase().trim();
      filtradas = filtradas.filter((t) => t.nombre.toLowerCase().includes(q));
    }

    if (filtroRiesgoTarifa !== "TODOS") {
      filtradas = filtradas.filter((t) => t.nivelRiesgo === filtroRiesgoTarifa);
    }

    const copia = [...filtradas];
    switch (criterioOrden) {
      case "volumen":
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
      case "fraudes":
        return copia.sort((a, b) => b.totalFraudes - a.totalFraudes);
      case "tasa":
        return copia.sort((a, b) => b.tasaFraude - a.tasaFraude);
      case "nombre":
        return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
      default:
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
    }
  }, [data, filtroTexto, filtroRiesgoTarifa, criterioOrden]);

  // Lista procesada de CUADRILLAS
  const cuadrillasProcesadas = useMemo(() => {
    if (!data?.cuadrillas) return [];
    let filtradas = data.cuadrillas;

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase().trim();
      filtradas = filtradas.filter((c) => c.nombre.toLowerCase().includes(q));
    }

    const copia = [...filtradas];
    switch (criterioOrden) {
      case "volumen":
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
      case "fraudes":
        return copia.sort((a, b) => b.totalFraudes - a.totalFraudes);
      case "tasa":
        return copia.sort((a, b) => b.tasaFraude - a.tasaFraude);
      case "nombre":
        return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
      default:
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
    }
  }, [data, filtroTexto, criterioOrden]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="stats-page-wrapper">
      <div className="executive-window">
        {/* Cabecera Principal */}
        <header className="executive-header">
          <div className="executive-header-titles">
            <h1 className="executive-title">
              Estadísticas Consolidadas del Sistema
            </h1>
            <p className="executive-subtitle">
              Distribución integral de estados de suministro, categorías tarifarias y asignación operativa de cuadrillas
            </p>
          </div>

          <div className="executive-actions">
            <button
              type="button"
              className="executive-btn"
              onClick={cargarMetricas}
              disabled={cargando}
              title="Refrescar métricas ahora"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={cargando ? "spinner-icon" : ""}
              >
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>{cargando ? "Actualizando..." : "Actualizar"}</span>
            </button>

            <button
              type="button"
              className="executive-btn"
              onClick={handlePrint}
              title="Imprimir o exportar a PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Imprimir</span>
            </button>

            <Link href="/informe-general" className="executive-btn">
              <span>Informe por Calles y Rutas</span>
            </Link>

            <Link href="/admin" className="executive-btn primary">
              <span>Mapa Operativo</span>
            </Link>
          </div>
        </header>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "12px 18px", borderRadius: "10px", color: "#b91c1c", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* ==========================================================
            4 TARJETAS KPI SUPERIORES EJECUTIVAS
            ========================================================== */}
        <section className="executive-kpi-grid">
          {/* Card 1: Total Suministros */}
          <div className="executive-kpi-card">
            <span className="kpi-title">TOTAL PADRÓN SUMINISTROS</span>
            <span className="kpi-value">
              {cargando ? "..." : (data?.globales.totalUsuarios || 0).toLocaleString()}
            </span>
          </div>

          {/* Card 2: Fraudes */}
          <div className="executive-kpi-card">
            <span className="kpi-title danger">CASOS DE FRAUDE ACTIVOS</span>
            <span className="kpi-value danger">
              {cargando ? "..." : (data?.globales.totalFraudes || 0).toLocaleString()}
            </span>
          </div>

          {/* Card 3: Estados y Tarifas */}
          <div className="executive-kpi-card">
            <span className="kpi-title">ESTADOS & TARIFAS</span>
            <span className="kpi-value">
              {cargando ? "..." : `${data?.globales.totalEstados || 0} / ${data?.globales.totalTarifas || 0}`}
            </span>
          </div>

          {/* Card 4: Cuadrillas Operativas */}
          <div className="executive-kpi-card">
            <span className="kpi-title">CUADRILLAS OPERATIVAS</span>
            <span className="kpi-value">
              {cargando ? "..." : (data?.globales.totalCuadrillas || 0)}
            </span>
          </div>
        </section>

        {/* ==========================================================
            BARRA DE PESTAÑAS Y CONTROLES DE FILTRO
            ========================================================== */}
        <div className="executive-controls-bar">
          <div className="executive-tabs">
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "ESTADOS" ? "active" : ""}`}
              onClick={() => {
                setVistaActiva("ESTADOS");
                setFiltroTexto("");
                setCriterioOrden("volumen");
              }}
            >
              📌 Estados del Padrón ({data?.estados.length || 0})
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "TARIFAS" ? "active" : ""}`}
              onClick={() => {
                setVistaActiva("TARIFAS");
                setFiltroTexto("");
                setCriterioOrden("volumen");
              }}
            >
              ⚡ Tarifas ({data?.tarifas.length || 0})
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "CUADRILLAS" ? "active" : ""}`}
              onClick={() => {
                setVistaActiva("CUADRILLAS");
                setFiltroTexto("");
                setCriterioOrden("volumen");
              }}
            >
              👷 Cuadrillas ({data?.cuadrillas.length || 0})
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "RESUMEN" ? "active" : ""}`}
              onClick={() => setVistaActiva("RESUMEN")}
            >
              📊 Resumen Consolidado
            </button>
          </div>

          {vistaActiva !== "RESUMEN" && (
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
              {/* Buscador de texto */}
              <div className="executive-search-wrapper">
                <svg
                  className="executive-search-icon"
                  width="14"
                  height="14"
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
                  className="executive-search-input"
                  placeholder={
                    vistaActiva === "ESTADOS"
                      ? "Buscar estado..."
                      : vistaActiva === "TARIFAS"
                      ? "Buscar código de tarifa..."
                      : "Buscar cuadrilla..."
                  }
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                />
              </div>

              {/* Filtros específicos según vista */}
              {vistaActiva === "ESTADOS" && (
                <select
                  value={filtroTipoEstado}
                  onChange={(e) => setFiltroTipoEstado(e.target.value as any)}
                  className="executive-tab-btn"
                  style={{ border: "1px solid #cbd5e1", background: "#fff", height: "34px" }}
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="FRAUDE">Solo Estados de Fraude</option>
                  <option value="REGULAR">Solo Estados Regulares</option>
                </select>
              )}

              {vistaActiva === "TARIFAS" && (
                <select
                  value={filtroRiesgoTarifa}
                  onChange={(e) => setFiltroRiesgoTarifa(e.target.value as any)}
                  className="executive-tab-btn"
                  style={{ border: "1px solid #cbd5e1", background: "#fff", height: "34px" }}
                >
                  <option value="TODOS">Todo Nivel de Riesgo</option>
                  <option value="Alto">Riesgo Alto (&ge; 40%)</option>
                  <option value="Medio">Riesgo Medio (15 - 40%)</option>
                  <option value="Bajo">Riesgo Bajo (&lt; 15%)</option>
                </select>
              )}

              {/* Ordenamiento */}
              <select
                value={criterioOrden}
                onChange={(e) => setCriterioOrden(e.target.value as any)}
                className="executive-tab-btn"
                style={{ border: "1px solid #cbd5e1", background: "#fff", height: "34px" }}
              >
                <option value="volumen">Mayor Volumen</option>
                <option value="fraudes">Más Fraudes</option>
                {vistaActiva === "TARIFAS" && <option value="tasa">Mayor Tasa de Fraude</option>}
                <option value="nombre">Orden Alfabético</option>
              </select>
            </div>
          )}
        </div>

        {/* ==========================================================
            VISTA 1: TABLA DE ESTADOS
            ========================================================== */}
        {vistaActiva === "ESTADOS" && (
          <div className="executive-table-card">
            <table className="executive-table">
              <thead>
                <tr>
                  <th style={{ width: "260px" }}>ESTADO DEL PADRÓN</th>
                  <th style={{ width: "130px" }}>TIPO</th>
                  <th className="center-col" style={{ width: "160px" }}>TOTAL USUARIOS</th>
                  <th className="center-col" style={{ width: "140px" }}>% DEL PADRÓN</th>
                  <th className="center-col" style={{ width: "130px" }}>EN DEPTOS</th>
                  <th className="center-col" style={{ width: "150px" }}>CON COORDENADAS</th>
                  <th className="center-col" style={{ width: "140px" }}>SIN COORDENADAS</th>
                  <th className="center-col" style={{ width: "160px" }}>COBERTURA GEO</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={8} className="table-empty-message">
                      Cargando estados del sistema...
                    </td>
                  </tr>
                ) : estadosProcesados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty-message">
                      No se encontraron estados coincidentes con el filtro.
                    </td>
                  </tr>
                ) : (
                  estadosProcesados.map((est) => {
                    const cobPct = est.totalUsuarios > 0 ? Math.round((est.conGeo / est.totalUsuarios) * 100) : 0;
                    return (
                      <tr key={est.id || est.nombre}>
                        <td>
                          <span
                            className="estado-badge-pill"
                            style={{
                              background: est.colorInfo.badgeBg,
                              color: est.colorInfo.badgeText,
                              border: `1px solid ${est.colorInfo.border}`,
                            }}
                          >
                            <span
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: est.colorInfo.bg,
                                display: "inline-block",
                              }}
                            />
                            {est.colorInfo.emoji ? `${est.colorInfo.emoji} ` : ""}
                            {est.nombre}
                          </span>
                        </td>
                        <td>
                          {est.esFraude ? (
                            <span className="risk-badge risk-alto">FRAUDE</span>
                          ) : (
                            <span className="risk-badge risk-bajo">REGULAR</span>
                          )}
                        </td>
                        <td className="center-col" style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                          {est.totalUsuarios.toLocaleString()}
                        </td>
                        <td className="center-col">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <div className="pct-track" style={{ width: "60px" }}>
                              <div
                                className="pct-fill-regular"
                                style={{
                                  width: `${Math.min(est.porcentajeDelTotal * 2, 100)}%`,
                                  background: est.colorInfo.bg,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: 700, minWidth: "38px" }}>
                              {est.porcentajeDelTotal}%
                            </span>
                          </div>
                        </td>
                        <td className="center-col" style={{ color: est.totalDeptos > 0 ? "#4f46e5" : "#64748b", fontWeight: est.totalDeptos > 0 ? 700 : 500 }}>
                          {est.totalDeptos > 0 ? `🏢 ${est.totalDeptos}` : "-"}
                        </td>
                        <td className="center-col" style={{ color: "#16a34a", fontWeight: 600 }}>
                          {est.conGeo.toLocaleString()}
                        </td>
                        <td className="center-col" style={{ color: est.sinGeo > 0 ? "#d97706" : "#64748b", fontWeight: 600 }}>
                          {est.sinGeo.toLocaleString()}
                        </td>
                        <td className="center-col">
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <div className="pct-track" style={{ width: "50px" }}>
                              <div
                                className="pct-fill-regular"
                                style={{
                                  width: `${cobPct}%`,
                                  background: cobPct >= 80 ? "#16a34a" : cobPct >= 50 ? "#eab308" : "#ef4444",
                                }}
                              />
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: 700 }}>
                              {cobPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ==========================================================
            VISTA 2: TABLA DE TARIFAS
            ========================================================== */}
        {vistaActiva === "TARIFAS" && (
          <div className="executive-table-card">
            <table className="executive-table">
              <thead>
                <tr>
                  <th style={{ width: "220px" }}>CÓDIGO DE TARIFA</th>
                  <th style={{ width: "140px" }}>NIVEL RIESGO</th>
                  <th className="center-col" style={{ width: "160px" }}>SUMINISTROS</th>
                  <th className="center-col" style={{ width: "140px" }}>% PADRÓN</th>
                  <th className="center-col" style={{ width: "150px" }}>CASOS FRAUDE</th>
                  <th className="center-col" style={{ width: "170px" }}>TASA DE FRAUDE</th>
                  <th className="center-col" style={{ width: "140px" }}>CON COORDENADAS</th>
                  <th className="center-col" style={{ width: "140px" }}>SIN COORDENADAS</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={8} className="table-empty-message">
                      Cargando categorías tarifarias...
                    </td>
                  </tr>
                ) : tarifasProcesadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty-message">
                      No se encontraron tarifas coincidentes con el filtro.
                    </td>
                  </tr>
                ) : (
                  tarifasProcesadas.map((tar) => (
                    <tr key={tar.id}>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: "13.5px", color: "#1e293b", fontFamily: "monospace" }}>
                          ⚡ {tar.nombre}
                        </span>
                      </td>
                      <td>
                        {tar.nivelRiesgo === "Alto" ? (
                          <span className="risk-badge risk-alto">ALTO RIESGO</span>
                        ) : tar.nivelRiesgo === "Medio" ? (
                          <span className="risk-badge risk-medio">RIESGO MEDIO</span>
                        ) : (
                          <span className="risk-badge risk-bajo">BAJO RIESGO</span>
                        )}
                      </td>
                      <td className="center-col" style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                        {tar.totalUsuarios.toLocaleString()}
                      </td>
                      <td className="center-col" style={{ fontSize: "12px", color: "#64748b" }}>
                        {tar.porcentajeDelTotal}%
                      </td>
                      <td className="center-col" style={{ color: tar.totalFraudes > 0 ? "#dc2626" : "#64748b", fontWeight: 800 }}>
                        {tar.totalFraudes.toLocaleString()}
                      </td>
                      <td className="center-col">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          <div className="pct-track" style={{ width: "60px" }}>
                            <div
                              className="pct-fill-danger"
                              style={{
                                width: `${Math.min(tar.tasaFraude, 100)}%`,
                                background:
                                  tar.tasaFraude >= 40
                                    ? "#ef4444"
                                    : tar.tasaFraude >= 15
                                    ? "#f97316"
                                    : "#10b981",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              minWidth: "42px",
                              color: tar.tasaFraude >= 15 ? "#b91c1c" : "#1e293b",
                            }}
                          >
                            {tar.tasaFraude}%
                          </span>
                        </div>
                      </td>
                      <td className="center-col" style={{ color: "#16a34a", fontWeight: 600 }}>
                        {tar.conGeo.toLocaleString()}
                      </td>
                      <td className="center-col" style={{ color: tar.sinGeo > 0 ? "#d97706" : "#64748b", fontWeight: 600 }}>
                        {tar.sinGeo.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ==========================================================
            VISTA 3: GRID DE CUADRILLAS
            ========================================================== */}
        {vistaActiva === "CUADRILLAS" && (
          <div>
            {/* Aviso de asignación */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "14px 20px",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ color: "#166534" }}>Estado de Asignación Operativa:</strong>{" "}
                <span style={{ color: "#15803d" }}>
                  {(data?.globales.usuariosEnCuadrillas || 0).toLocaleString()} asignados a cuadrillas (
                  {data?.globales.porcentajeAsignadoCuadrillas || 0}%) &bull;{" "}
                  <strong style={{ color: "#b45309" }}>
                    {(data?.globales.usuariosSinCuadrilla || 0).toLocaleString()}
                  </strong>{" "}
                  pendientes de asignar.
                </span>
              </div>
              <Link href="/usuarios" className="executive-btn" style={{ background: "#ffffff" }}>
                <span>Ir a Gestión para Asignar</span>
              </Link>
            </div>

            {cargando ? (
              <div className="table-empty-message">Cargando cuadrillas operativas...</div>
            ) : cuadrillasProcesadas.length === 0 ? (
              <div className="table-empty-message">No se encontraron cuadrillas registradas.</div>
            ) : (
              <div className="cuadrillas-grid">
                {cuadrillasProcesadas.map((c) => (
                  <div key={c.id} className="cuadrilla-card">
                    <div className="cuadrilla-header">
                      <div>
                        <h3 className="cuadrilla-name">
                          👷 {c.nombre}
                        </h3>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          ID Cuadrilla: #{c.id}
                        </span>
                      </div>
                      <span
                        className="cuadrilla-badge"
                        style={{
                          background: c.totalUsuarios > 0 ? "#eff6ff" : "#f1f5f9",
                          color: c.totalUsuarios > 0 ? "#1d4ed8" : "#64748b",
                          border: `1px solid ${c.totalUsuarios > 0 ? "#bfdbfe" : "#e2e8f0"}`,
                        }}
                      >
                        {c.totalUsuarios > 0 ? `${c.totalUsuarios} Suministros` : "Sin asignaciones"}
                      </span>
                    </div>

                    <div className="cuadrilla-stats-row">
                      <div className="cuadrilla-stat-item">
                        <span className="cuadrilla-stat-label">Casos Fraude</span>
                        <span className="cuadrilla-stat-val" style={{ color: c.totalFraudes > 0 ? "#dc2626" : "#1e293b" }}>
                          {c.totalFraudes} ({c.tasaFraude}%)
                        </span>
                      </div>
                      <div className="cuadrilla-stat-item">
                        <span className="cuadrilla-stat-label">Con Coordenadas</span>
                        <span className="cuadrilla-stat-val" style={{ color: "#16a34a" }}>
                          {c.conGeo} / {c.totalUsuarios}
                        </span>
                      </div>
                    </div>

                    {/* Desglose de estados en esta cuadrilla */}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                        Desglose por Estado:
                      </span>
                      {Object.keys(c.desgloseEstados).length === 0 ? (
                        <p style={{ fontSize: "12px", color: "#94a3b8", margin: "6px 0 0" }}>
                          Sin usuarios asignados aún a esta cuadrilla.
                        </p>
                      ) : (
                        <div className="cuadrilla-chips-container">
                          {Object.entries(c.desgloseEstados).map(([estNom, cant]) => (
                            <span
                              key={estNom}
                              className="estado-chip"
                              style={{
                                background: /FRAUDE/i.test(estNom) ? "#fee2e2" : "#f1f5f9",
                                color: /FRAUDE/i.test(estNom) ? "#b91c1c" : "#334155",
                                border: `1px solid ${/FRAUDE/i.test(estNom) ? "#fca5a5" : "#cbd5e1"}`,
                              }}
                            >
                              <span>{estNom}:</span>
                              <strong>{cant}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link
                        href={`/admin`}
                        className="executive-btn"
                        style={{ fontSize: "12px", padding: "5px 12px", background: "#f8fafc" }}
                      >
                        Ver en Mapa
                      </Link>
                      <Link
                        href={`/usuarios`}
                        className="executive-btn"
                        style={{ fontSize: "12px", padding: "5px 12px" }}
                      >
                        Gestionar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==========================================================
            VISTA 4: RESUMEN CONSOLIDADO
            ========================================================== */}
        {vistaActiva === "RESUMEN" && data && (
          <div className="summary-columns-grid">
            {/* Columna 1: Top Estados */}
            <div className="summary-col-card">
              <div className="summary-col-title">
                <span>Top 5 Estados por Volumen</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Padrón General</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.estados.slice(0, 5).map((est, idx) => (
                  <div
                    key={est.id || est.nombre}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 800, color: "#94a3b8", width: "16px" }}>#{idx + 1}</span>
                      <span
                        className="estado-badge-pill"
                        style={{
                          background: est.colorInfo.badgeBg,
                          color: est.colorInfo.badgeText,
                          border: `1px solid ${est.colorInfo.border}`,
                          fontSize: "11px",
                          padding: "2px 8px",
                        }}
                      >
                        {est.nombre}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>
                        {est.totalUsuarios.toLocaleString()}
                      </span>
                      <span style={{ display: "block", fontSize: "10.5px", color: "#64748b" }}>
                        {est.porcentajeDelTotal}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna 2: Top Tarifas con Fraude */}
            <div className="summary-col-card">
              <div className="summary-col-title">
                <span>Tarifas con Mayor Volumen</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Incidencia de Fraude</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.tarifas.slice(0, 5).map((tar, idx) => (
                  <div
                    key={tar.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: 800, color: "#94a3b8", width: "16px" }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "12px", color: "#1e293b" }}>
                        ⚡ {tar.nombre}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "13px" }}>
                        {tar.totalUsuarios.toLocaleString()}
                      </span>
                      <span style={{ display: "block", fontSize: "10.5px", color: tar.totalFraudes > 0 ? "#dc2626" : "#64748b", fontWeight: tar.totalFraudes > 0 ? 700 : 400 }}>
                        {tar.totalFraudes} fraudes ({tar.tasaFraude}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna 3: Balance Operativo */}
            <div className="summary-col-card">
              <div className="summary-col-title">
                <span>Balance Operativo Cuadrillas</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Distribución</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                    <span style={{ color: "#64748b" }}>Usuarios Asignados a Equipos</span>
                    <strong style={{ color: "#15803d" }}>{data.globales.porcentajeAsignadoCuadrillas}%</strong>
                  </div>
                  <div className="pct-track" style={{ width: "100%", height: "8px" }}>
                    <div
                      className="pct-fill-regular"
                      style={{
                        width: `${data.globales.porcentajeAsignadoCuadrillas}%`,
                        background: "#16a34a",
                      }}
                    />
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                    <span style={{ color: "#64748b" }}>Cobertura con Coordenadas GPS</span>
                    <strong style={{ color: "#2563eb" }}>{data.globales.porcentajeGeo}%</strong>
                  </div>
                  <div className="pct-track" style={{ width: "100%", height: "8px" }}>
                    <div
                      className="pct-fill-regular"
                      style={{
                        width: `${data.globales.porcentajeGeo}%`,
                        background: "#2563eb",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                    Cuadrillas Activas: <strong>{data.globales.totalCuadrillas}</strong>
                  </span>
                  <Link href="/admin" className="executive-btn primary" style={{ fontSize: "12px", padding: "6px 12px" }}>
                    Ver Mapa
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer del Informe */}
        <footer
          style={{
            marginTop: "30px",
            paddingTop: "16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          <span>
            Sistema de Detección y Seguimiento de Fraudes &bull; Zárate, Buenos Aires
          </span>
          <span>
            Última actualización:{" "}
            {data?.actualizadoEl
              ? new Date(data.actualizadoEl).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Cargando..."}
          </span>
        </footer>
      </div>
    </div>
  );
}
