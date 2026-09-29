"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import "../css/estadisticas.css";

interface CalleStat {
  calle: string;
  totalUsuarios: number;
  totalFraudes: number;
  porcentajeFraude: number;
  nivelRiesgo: "Alto" | "Medio" | "Bajo";
}

interface RutaStat {
  ruta: string;
  rutaNumero: number;
  totalUsuarios: number;
  totalFraudes: number;
  porcentajeFraude: number;
  nivelRiesgo: "Alto" | "Medio" | "Bajo";
}

interface EstadisticasResponse {
  globales: {
    totalUsuarios: number;
    totalFraudes: number;
    totalNormales: number;
    porcentajeFraude: number;
    conGeo: number;
    sinGeo: number;
    porcentajeGeo: number;
    desgloseFraudes: Record<string, number>;
    desgloseEstados: Record<string, number>;
    calleMayorIncidencia: string;
    rutaMayorIncidencia: string;
  };
  porCalle: CalleStat[];
  porRuta: RutaStat[];
  actualizadoEl: string;
}

export default function InformeGeneralPage() {
  const [data, setData] = useState<EstadisticasResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Vista activa: Calles o Rutas
  const [vistaActiva, setVistaActiva] = useState<"CALLES" | "RUTAS">("CALLES");
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroRiesgo, setFiltroRiesgo] = useState<"TODOS" | "Alto" | "Medio" | "Bajo">("TODOS");
  const [criterioOrden, setCriterioOrden] = useState<"fraudes" | "tasa" | "usuarios" | "nombre">("fraudes");

  const cargarInforme = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await fetch("/api/estadisticasapi", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al obtener los datos del informe general");
      const json: EstadisticasResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError("No se pudo cargar el informe general. Verifica la conexión.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarInforme();
  }, [cargarInforme]);

  // Lista procesada de Calles
  const callesProcesadas = useMemo(() => {
    if (!data?.porCalle) return [];
    let filtradas = data.porCalle.filter(
      (c) =>
        c.calle.toLowerCase() !== "calle no identificada" &&
        c.calle.toLowerCase() !== "sin domicilio" &&
        c.calle.toLowerCase() !== "calle"
    );

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase().trim();
      filtradas = filtradas.filter((c) => c.calle.toLowerCase().includes(q));
    }

    if (filtroRiesgo !== "TODOS") {
      filtradas = filtradas.filter((c) => c.nivelRiesgo === filtroRiesgo);
    }

    const copia = [...filtradas];
    switch (criterioOrden) {
      case "fraudes":
        return copia.sort((a, b) => b.totalFraudes - a.totalFraudes);
      case "tasa":
        return copia.sort((a, b) => b.porcentajeFraude - a.porcentajeFraude);
      case "usuarios":
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
      case "nombre":
        return copia.sort((a, b) => a.calle.localeCompare(b.calle));
      default:
        return copia;
    }
  }, [data, filtroTexto, filtroRiesgo, criterioOrden]);

  // Lista procesada de Rutas
  const rutasProcesadas = useMemo(() => {
    if (!data?.porRuta) return [];
    let filtradas = data.porRuta;

    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase().trim();
      filtradas = filtradas.filter((r) =>
        `ruta ${r.ruta}`.toLowerCase().includes(q) || r.ruta.toLowerCase().includes(q)
      );
    }

    if (filtroRiesgo !== "TODOS") {
      filtradas = filtradas.filter((r) => r.nivelRiesgo === filtroRiesgo);
    }

    const copia = [...filtradas];
    switch (criterioOrden) {
      case "fraudes":
        return copia.sort((a, b) => b.totalFraudes - a.totalFraudes);
      case "tasa":
        return copia.sort((a, b) => b.porcentajeFraude - a.porcentajeFraude);
      case "usuarios":
        return copia.sort((a, b) => b.totalUsuarios - a.totalUsuarios);
      case "nombre":
        return copia.sort((a, b) => a.rutaNumero - b.rutaNumero);
      default:
        return copia;
    }
  }, [data, filtroTexto, filtroRiesgo, criterioOrden]);

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
              {vistaActiva === "CALLES"
                ? "Informe de Detección de Fraudes por Calle"
                : "Informe de Detección de Fraudes por Ruta"}
            </h1>
            <p className="executive-subtitle">
              Métricas consolidadas de usuarios activos y casos sospechosos/confirmados
            </p>
          </div>

          <div className="executive-actions">
            <button
              type="button"
              className="executive-btn"
              onClick={cargarInforme}
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
              title="Imprimir informe en papel o guardar como PDF"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Imprimir / PDF</span>
            </button>

            <Link href="/estadisticas" className="executive-btn">
              <span>Estadísticas del Sistema</span>
            </Link>

            <Link href="/admin" className="executive-btn primary">
              <span>Mapa Operativo</span>
            </Link>
          </div>
        </header>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "12px 18px", borderRadius: "10px", color: "#b91c1c", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {/* 4 Tarjetas Métricas Superiores (Idénticas a la imagen del usuario) */}
        {data && (
          <section className="executive-kpi-grid">
            <div className="executive-kpi-card">
              <span className="kpi-title">Total Usuarios Analizados</span>
              <span className="kpi-value">
                {data.globales.totalUsuarios.toLocaleString()}
              </span>
            </div>

            <div className="executive-kpi-card">
              <span className="kpi-title danger">Total Casos de Fraude</span>
              <span className="kpi-value danger">
                {data.globales.totalFraudes.toLocaleString()}
              </span>
            </div>

            <div className="executive-kpi-card">
              <span className="kpi-title">Tasa Promedio de Fraude</span>
              <span className="kpi-value">
                {data.globales.porcentajeFraude.toFixed(2)}%
              </span>
            </div>

            <div className="executive-kpi-card">
              <span className="kpi-title">
                {vistaActiva === "CALLES" ? "Calle con Mayor Incidencia" : "Ruta con Mayor Incidencia"}
              </span>
              <span
                className="kpi-value highlight-text"
                title={vistaActiva === "CALLES" ? data.globales.calleMayorIncidencia : data.globales.rutaMayorIncidencia}
              >
                {vistaActiva === "CALLES" ? data.globales.calleMayorIncidencia : data.globales.rutaMayorIncidencia}
              </span>
            </div>
          </section>
        )}

        {/* Barra de Controles, Pestañas y Búsqueda */}
        <section className="executive-controls-bar">
          <div className="executive-tabs">
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "CALLES" ? "active" : ""}`}
              onClick={() => {
                setVistaActiva("CALLES");
                setFiltroTexto("");
              }}
            >
              Ver por Calle / Avenida
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${vistaActiva === "RUTAS" ? "active" : ""}`}
              onClick={() => {
                setVistaActiva("RUTAS");
                setFiltroTexto("");
              }}
            >
              Ver por Ruta / Sector
            </button>
          </div>

          <div className="executive-search-wrapper">
            <svg
              className="executive-search-icon"
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
              className="executive-search-input"
              placeholder={vistaActiva === "CALLES" ? "Buscar calle (ej: Ameghino, Mitre)..." : "Buscar ruta (ej: 24, 28)..."}
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>

          <div className="executive-tabs">
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginRight: "4px" }}>
              Nivel:
            </span>
            {(["TODOS", "Alto", "Medio", "Bajo"] as const).map((nivel) => (
              <button
                key={nivel}
                type="button"
                className={`executive-tab-btn ${filtroRiesgo === nivel ? "active" : ""}`}
                onClick={() => setFiltroRiesgo(nivel)}
              >
                {nivel === "TODOS" ? "Todos" : nivel}
              </button>
            ))}
          </div>

          <div className="executive-tabs">
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", marginRight: "4px" }}>
              Ordenar:
            </span>
            <button
              type="button"
              className={`executive-tab-btn ${criterioOrden === "fraudes" ? "active" : ""}`}
              onClick={() => setCriterioOrden("fraudes")}
            >
              Más Fraudes
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${criterioOrden === "tasa" ? "active" : ""}`}
              onClick={() => setCriterioOrden("tasa")}
            >
              Mayor %
            </button>
            <button
              type="button"
              className={`executive-tab-btn ${criterioOrden === "usuarios" ? "active" : ""}`}
              onClick={() => setCriterioOrden("usuarios")}
            >
              Usuarios
            </button>
          </div>
        </section>

        {/* Tabla Ejecutiva de Fraudes (Exacta al estilo del screenshot) */}
        <section className="executive-table-card">
          <table className="executive-table">
            <thead>
              <tr>
                <th>{vistaActiva === "CALLES" ? "Calle / Avenida" : "Ruta / Sector"}</th>
                <th>Usuarios Totales</th>
                <th>Usuarios con Fraude</th>
                <th>Porcentaje de Fraude</th>
                <th className="center-col">Nivel de Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {cargando && !data ? (
                <tr>
                  <td colSpan={5} className="table-empty-message">
                    Cargando informe y métricas consolidadas...
                  </td>
                </tr>
              ) : vistaActiva === "CALLES" ? (
                callesProcesadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-message">
                      No se encontraron calles con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  callesProcesadas.slice(0, 50).map((c) => {
                    const pct = c.porcentajeFraude;
                    const riesgoClase = c.nivelRiesgo.toLowerCase();

                    return (
                      <tr key={c.calle}>
                        <td className="item-name">{c.calle}</td>
                        <td>
                          <div className="table-stat-cell">
                            <span className="table-stat-pipe">|</span>
                            <span className="table-stat-number">{c.totalUsuarios.toLocaleString()}</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-stat-cell">
                            <span className="table-stat-pipe">|</span>
                            <span className="table-stat-number">{c.totalFraudes.toLocaleString()}</span>
                          </div>
                        </td>
                        <td>
                          <div className="pct-bar-cell">
                            <span className="pct-text">{pct.toFixed(2)}%</span>
                            <div className="pct-track" title={`${pct.toFixed(2)}% de fraude`}>
                              <div
                                className="pct-fill"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`risk-badge ${riesgoClase}`}>
                            {c.nivelRiesgo}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                rutasProcesadas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-message">
                      No se encontraron rutas con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  rutasProcesadas.map((r) => {
                    const pct = r.porcentajeFraude;
                    const riesgoClase = r.nivelRiesgo.toLowerCase();

                    return (
                      <tr key={r.ruta}>
                        <td className="item-name">Ruta {r.ruta}</td>
                        <td>
                          <div className="table-stat-cell">
                            <span className="table-stat-pipe">|</span>
                            <span className="table-stat-number">{r.totalUsuarios.toLocaleString()}</span>
                          </div>
                        </td>
                        <td>
                          <div className="table-stat-cell">
                            <span className="table-stat-pipe">|</span>
                            <span className="table-stat-number">{r.totalFraudes.toLocaleString()}</span>
                          </div>
                        </td>
                        <td>
                          <div className="pct-bar-cell">
                            <span className="pct-text">{pct.toFixed(2)}%</span>
                            <div className="pct-track" title={`${pct.toFixed(2)}% de fraude`}>
                              <div
                                className="pct-fill"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`risk-badge ${riesgoClase}`}>
                            {r.nivelRiesgo}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </section>

        {/* Distribución por Categoría de Fraude */}
        {data && Object.keys(data.globales.desgloseFraudes).length > 0 && (
          <section className="secondary-panel-card">
            <h2 className="secondary-panel-title">
              <span>Distribución por Estados de Fraude</span>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                Total: {data.globales.totalFraudes.toLocaleString()} casos
              </span>
            </h2>

            <div className="desglose-chips-grid">
              {Object.entries(data.globales.desgloseFraudes).map(([tipo, cant]) => {
                const pct = data.globales.totalFraudes > 0
                  ? ((cant / data.globales.totalFraudes) * 100).toFixed(1)
                  : "0.0";

                return (
                  <div key={tipo} className="desglose-chip">
                    <span className="chip-label">{tipo}</span>
                    <span className="chip-value">{cant.toLocaleString()}</span>
                    <div className="chip-bar-track">
                      <div className="chip-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700, marginTop: "2px" }}>
                      {pct}% del total
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
