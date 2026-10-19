"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatFechaImagen } from "@/lib/imageUtils";

interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
  createdAt?: string | Date | null;
}

interface FichaClienteProps {
  usuario: {
    id: number;
    nroUsuario: string;
    nombre: string;
    domicilio: string | null;
    medidor: string | null;
    ruta: string | null;
    latitud: number | null;
    longitud: number | null;
    observaciones?: string | null;
    estado?: { id: number; nombre: string } | null;
    estadoDepto?: { id: number; nombre: string } | null;
    tarifa?: { id: number; nombre: string } | null;
    esDepartamento?: boolean;
    fechaVtoFormatted?: string;
    tituloTarea?: string | null;
    listadoTitulo?: string | null;
    completado?: boolean;
    idListadoItem?: number | null;
    idListado?: number | null;
  };
  configEstado: {
    key: string;
    nombre: string;
    bg: string;
    text: string;
    border: string;
    dotColor?: string;
  };
  imagenes: ImagenItem[];
}

export default function FichaCliente({
  usuario,
  configEstado,
  imagenes,
}: FichaClienteProps) {
  const [fotoIndex, setFotoIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [completado, setCompletado] = useState(!!usuario.completado);
  const [guardandoCompletado, setGuardandoCompletado] = useState(false);

  const lat = usuario.latitud;
  const lon = usuario.longitud;
  const tieneCoords = lat !== null && lon !== null;

  // URL para ver punto en Google Maps (con coordenadas o búsqueda por dirección en Zárate)
  const urlPuntoGmaps = tieneCoords
    ? `https://www.google.com/maps?q=${lat},${lon}`
    : usuario.domicilio
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${usuario.domicilio}, Zarate, Buenos Aires`)}`
    : "";

  const handlePrevFoto = () => {
    if (imagenes.length <= 1) return;
    setFotoIndex((prev) => (prev > 0 ? prev - 1 : imagenes.length - 1));
  };

  const handleNextFoto = () => {
    if (imagenes.length <= 1) return;
    setFotoIndex((prev) => (prev < imagenes.length - 1 ? prev + 1 : 0));
  };

  const handleCopiarEnlace = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  const handleToggleCompletado = async () => {
    const nuevoEstado = !completado;
    setCompletado(nuevoEstado);
    setGuardandoCompletado(true);

    try {
      if (usuario.idListadoItem) {
        await fetch("/api/listados/item", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: usuario.idListadoItem,
            completado: nuevoEstado,
          }),
        });
      }
      await fetch("/api/usuarios/completado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: usuario.id,
          completado: nuevoEstado,
        }),
      });
    } catch (e) {
      console.error("Error al guardar estado de completado:", e);
    } finally {
      setGuardandoCompletado(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 50% 0%, #34966a 0%, #3eb187 60%, #3caf85 100%)",
        color: "#0f172a",
        padding: "28px 24px 60px 24px",
        fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Contenedor central ancho completo */}
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* Cabecera institucional ancha */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            padding: "16px 24px",
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow: "0 10px 35px rgba(0, 0, 0, 0.18)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <Link
            href="/usuarios"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "#334155",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 700,
              background: "#f1f5f9",
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              transition: "all 0.15s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver al listado</span>
          </Link>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "16px", fontWeight: "800", color: "#107c41", letterSpacing: "0.5px" }}>
              CEZ ZÁRATE
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              Ficha Técnica de Inspección
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopiarEnlace}
            style={{
              background: copiado ? "#15803d" : "#107c41",
              color: "#ffffff",
              border: "none",
              padding: "9px 18px",
              borderRadius: "10px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(16, 124, 65, 0.3)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{copiado ? "Enlace copiado" : "Compartir"}</span>
          </button>
        </div>

        {/* Banner de Tarea Asignada (si viene de un listado de cuadrilla) */}
        {usuario.tituloTarea && (
          <div
            className="ficha-task-banner"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
              color: "#ffffff",
              padding: "16px 20px",
              borderRadius: "16px",
              marginBottom: "20px",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
              border: "1.5px solid rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>📋</span>
              <div>
                <div style={{ fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.8px", color: "#94a3b8", fontWeight: 800 }}>
                  {usuario.listadoTitulo ? `Listado: ${usuario.listadoTitulo}` : "Tarea Asignada a Cuadrilla"}
                </div>
                <div style={{ fontSize: "18.5px", fontWeight: 900, color: "#38bdf8", letterSpacing: "0.3px" }}>
                  {usuario.tituloTarea}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={guardandoCompletado}
              onClick={handleToggleCompletado}
              style={{
                background: completado ? "#16a34a" : "#ffffff",
                color: completado ? "#ffffff" : "#0f172a",
                border: completado ? "none" : "2px solid #cbd5e1",
                padding: "11px 20px",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "14px",
                cursor: guardandoCompletado ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: completado ? "0 4px 14px rgba(22, 163, 74, 0.4)" : "none",
                minHeight: "44px",
              }}
            >
              <span>{completado ? "✓ TAREA REALIZADA" : "Marcar como Realizada"}</span>
            </button>
          </div>
        )}

        {/* Layout en 2 columnas amplias */}
        <div
          className="ficha-grid-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* COLUMNA 1: Datos Principales del Usuario y Acciones */}
          <div
            className="ficha-card-block"
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "26px",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.22)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
            }}
          >
            {/* Estado y Nro de Usuario */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: configEstado.bg,
                  color: configEstado.text,
                  border: `1.5px solid ${configEstado.border}`,
                  padding: "6px 16px",
                  borderRadius: "30px",
                  fontSize: "13px",
                  fontWeight: "800",
                  letterSpacing: "0.3px",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: configEstado.dotColor || "#ffffff",
                    display: "inline-block",
                  }}
                />
                <span>{usuario.estado?.nombre || "Sin Estado"}</span>
              </div>

              <span
                style={{
                  fontSize: "14px",
                  color: "#0b5c30",
                  fontWeight: "800",
                  background: "#dcfce7",
                  border: "1px solid #bbf7d0",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  letterSpacing: "0.3px",
                }}
              >
                Usuario #{usuario.nroUsuario}
              </span>
            </div>

            {/* Titular */}
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "800",
                color: "#0f172a",
                margin: "0 0 18px 0",
                lineHeight: "1.3",
                letterSpacing: "-0.01em",
              }}
            >
              {usuario.nombre}
            </h1>

            {/* Datos detallados */}
            <div
              style={{
                display: "grid",
                gap: "12px",
                background: "#f8fafc",
                padding: "18px 20px",
                borderRadius: "14px",
                border: "1.5px solid #e2e8f0",
                fontSize: "14.5px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Domicilio:</span>
                <span style={{ fontWeight: "800", color: "#0f172a" }}>{usuario.domicilio || "—"}</span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Medidor:</span>
                <span style={{ fontWeight: "800", color: "#b45309" }}>{usuario.medidor || "—"}</span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Ruta:</span>
                <span style={{ fontWeight: "700", color: "#0f172a" }}>{usuario.ruta || "—"}</span>
              </div>

              {usuario.fechaVtoFormatted && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Vencimiento:</span>
                  <span style={{ fontWeight: "800", color: "#b91c1c" }}>{usuario.fechaVtoFormatted}</span>
                </div>
              )}

              {usuario.esDepartamento && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Inmueble:</span>
                  <span style={{ color: "#7e22ce", fontWeight: "700" }}>{usuario.estadoDepto?.nombre || "Departamento"}</span>
                </div>
              )}

              {usuario.tarifa && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ color: "#64748b", minWidth: "100px", fontWeight: "600" }}>Tarifa:</span>
                  <span style={{ color: "#334155", fontWeight: "600" }}>{usuario.tarifa.nombre}</span>
                </div>
              )}

              {usuario.observaciones && (
                <div style={{ marginTop: "6px", paddingTop: "10px", borderTop: "1px dashed #cbd5e1" }}>
                  <div style={{ color: "#64748b", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Observaciones Técnicas:</div>
                  <div style={{ color: "#334155", fontSize: "13.5px", fontStyle: "italic", background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    {usuario.observaciones}
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: "grid", gap: "12px" }}>
              {/* Botón de Marcar como Realizado en la Ficha */}
              <button
                type="button"
                disabled={guardandoCompletado}
                onClick={handleToggleCompletado}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  background: completado
                    ? "linear-gradient(135deg, #15803d, #16a34a)"
                    : "#ffffff",
                  color: completado ? "#ffffff" : "#166534",
                  border: completado ? "none" : "2px solid #86efac",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  fontWeight: "800",
                  fontSize: "16px",
                  cursor: guardandoCompletado ? "wait" : "pointer",
                  boxShadow: completado ? "0 6px 18px rgba(22, 163, 74, 0.35)" : "none",
                  transition: "all 0.15s ease",
                  minHeight: "52px",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  {completado ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="9" />}
                </svg>
                <span>{completado ? "✓ USUARIO / TAREA COMPLETADA" : "Marcar Usuario como Realizado"}</span>
              </button>

              {/* Botón Ver punto en Maps */}
              {urlPuntoGmaps ? (
                <a
                  href={urlPuntoGmaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    background: "linear-gradient(135deg, #0284c7, #0369a1)",
                    color: "#ffffff",
                    padding: "16px 20px",
                    borderRadius: "14px",
                    fontWeight: "800",
                    fontSize: "15.5px",
                    textDecoration: "none",
                    boxShadow: "0 6px 18px rgba(2, 132, 199, 0.25)",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                    minHeight: "52px",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Ver punto en Maps</span>
                </a>
              ) : (
                <div
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #fecaca",
                    padding: "12px",
                    borderRadius: "10px",
                    textAlign: "center",
                    color: "#991b1b",
                    fontSize: "13.5px",
                    fontWeight: 700,
                  }}
                >
                  Este suministro no cuenta con dirección ni coordenadas GPS cargadas.
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 2: Galería de Fotos con Botones Laterales en la Plantilla */}
          <div
            className="ficha-card-block"
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "26px",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.22)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#107c41" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                  Fotos de Inspección
                </h2>
              </div>
              <span
                style={{
                  background: imagenes.length > 0 ? "#dcfce7" : "#f1f5f9",
                  color: imagenes.length > 0 ? "#166534" : "#64748b",
                  border: imagenes.length > 0 ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "800",
                }}
              >
                {imagenes.length} {imagenes.length === 1 ? "foto" : "fotos"}
              </span>
            </div>

            {imagenes.length === 0 ? (
              <div
                style={{
                  padding: "48px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: "14px",
                  border: "1.5px dashed #cbd5e1",
                  color: "#64748b",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
                  Sin fotos registradas
                </div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Este suministro todavía no tiene fotografías adjuntas en el sistema.
                </div>
              </div>
            ) : (
              <div>
                {/* VISOR PRINCIPAL CON BOTONES LATERALES */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "380px",
                    borderRadius: "14px",
                    overflow: "hidden",
                    backgroundColor: "#0f172a",
                    border: "1.5px solid #cbd5e1",
                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Foto actual */}
                  {imagenes[fotoIndex] && (
                    <Image
                      src={imagenes[fotoIndex].url}
                      alt={`Foto inspección ${fotoIndex + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 600px"
                      style={{ objectFit: "contain", cursor: "pointer" }}
                      onClick={() => setSelectedImageIndex(fotoIndex)}
                      priority
                    />
                  )}

                  {/* Botón Lateral Izquierdo (<) */}
                  {imagenes.length > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevFoto}
                      aria-label="Foto anterior"
                      title="Foto anterior"
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "#ffffff",
                        border: "1.5px solid rgba(255, 255, 255, 0.35)",
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        backdropFilter: "blur(6px)",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
                        transition: "all 0.15s ease",
                        zIndex: 10,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  )}

                  {/* Botón Lateral Derecho (>) */}
                  {imagenes.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNextFoto}
                      aria-label="Foto siguiente"
                      title="Foto siguiente"
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "#ffffff",
                        border: "1.5px solid rgba(255, 255, 255, 0.35)",
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        backdropFilter: "blur(6px)",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
                        transition: "all 0.15s ease",
                        zIndex: 10,
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}

                  {/* Contador de foto */}
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      left: "12px",
                      background: "rgba(0, 0, 0, 0.72)",
                      color: "#ffffff",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      backdropFilter: "blur(4px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      zIndex: 10,
                    }}
                  >
                    Foto {fotoIndex + 1} de {imagenes.length}
                  </div>

                  {/* Fecha de la foto */}
                  {imagenes[fotoIndex]?.createdAt && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "12px",
                        left: "12px",
                        background: "rgba(0, 0, 0, 0.72)",
                        color: "#e2e8f0",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        backdropFilter: "blur(4px)",
                        zIndex: 10,
                      }}
                    >
                      {formatFechaImagen(imagenes[fotoIndex])}
                    </div>
                  )}

                  {/* Botón Ampliar Pantalla Completa */}
                  <button
                    type="button"
                    onClick={() => setSelectedImageIndex(fotoIndex)}
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      right: "12px",
                      background: "rgba(0, 0, 0, 0.75)",
                      color: "#ffffff",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      padding: "7px 14px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(4px)",
                      zIndex: 10,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                    <span>Ampliar</span>
                  </button>
                </div>

                {/* Tira inferior de miniaturas */}
                {imagenes.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      overflowX: "auto",
                      paddingTop: "12px",
                      paddingBottom: "4px",
                    }}
                  >
                    {imagenes.map((img, idx) => (
                      <button
                        key={img.id || idx}
                        type="button"
                        onClick={() => setFotoIndex(idx)}
                        style={{
                          position: "relative",
                          width: "64px",
                          height: "64px",
                          flexShrink: 0,
                          borderRadius: "10px",
                          overflow: "hidden",
                          border: idx === fotoIndex ? "3px solid #107c41" : "1.5px solid #cbd5e1",
                          padding: 0,
                          cursor: "pointer",
                          background: "#0f172a",
                          opacity: idx === fotoIndex ? 1 : 0.6,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Image
                          src={img.url}
                          alt={`Miniatura ${idx + 1}`}
                          fill
                          sizes="64px"
                          style={{ objectFit: "cover" }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL LIGHTBOX PANTALLA COMPLETA CON BOTONES LATERALES */}
      {selectedImageIndex !== null && imagenes[selectedImageIndex] && (
        <div
          onClick={() => setSelectedImageIndex(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.94)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={() => setSelectedImageIndex(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              border: "none",
              borderRadius: "50%",
              width: "48px",
              height: "48px",
              fontSize: "22px",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100000,
            }}
          >
            ✕
          </button>

          {/* Flecha Lateral Izquierda Fullscreen */}
          {imagenes.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) =>
                  prev !== null ? (prev > 0 ? prev - 1 : imagenes.length - 1) : 0
                );
              }}
              aria-label="Foto anterior"
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "52px",
                height: "52px",
                fontSize: "24px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100000,
                backdropFilter: "blur(6px)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Flecha Lateral Derecha Fullscreen */}
          {imagenes.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((prev) =>
                  prev !== null ? (prev < imagenes.length - 1 ? prev + 1 : 0) : 0
                );
              }}
              aria-label="Foto siguiente"
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 255, 255, 0.25)",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "52px",
                height: "52px",
                fontSize: "24px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100000,
                backdropFilter: "blur(6px)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Imagen en grande */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: "1000px", height: "75vh", maxHeight: "750px" }}
          >
            <Image
              src={imagenes[selectedImageIndex].url}
              alt="Foto inspección en pantalla completa"
              fill
              sizes="100vw"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>

          {/* Info y fecha debajo */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: "16px", textAlign: "center", color: "#e2e8f0", fontSize: "14px", display: "flex", gap: "14px", alignItems: "center" }}
          >
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "5px 14px", borderRadius: "20px", fontWeight: 800 }}>
              Foto {selectedImageIndex + 1} de {imagenes.length}
            </span>
            {imagenes[selectedImageIndex].createdAt && (
              <span style={{ background: "rgba(255,255,255,0.15)", padding: "5px 14px", borderRadius: "20px", fontWeight: 600 }}>
                Fecha: {formatFechaImagen(imagenes[selectedImageIndex])}
              </span>
            )}
            <a
              href={imagenes[selectedImageIndex].url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 700, fontSize: "13px" }}
            >
              Abrir archivo original ↗
            </a>
          </div>
        </div>
      )}

      {/* Estilos responsive optimizados para celular */}
      <style>{`
        @media (max-width: 768px) {
          .ficha-grid-layout {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .ficha-card-block {
            padding: 18px 14px !important;
            border-radius: 14px !important;
          }
          .ficha-task-banner {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 14px 16px !important;
          }
          .ficha-task-banner button {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}
