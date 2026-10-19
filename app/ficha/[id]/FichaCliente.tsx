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
  const [selectedImage, setSelectedImage] = useState<ImagenItem | null>(null);
  const [copiado, setCopiado] = useState(false);

  const lat = usuario.latitud;
  const lon = usuario.longitud;
  const tieneCoords = lat !== null && lon !== null;

  // URLs de Google Maps
  const urlNavegacionGmaps = tieneCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
    : "";
  const urlPuntoGmaps = tieneCoords
    ? `https://www.google.com/maps?q=${lat},${lon}`
    : "";

  // Mensaje para compartir por WhatsApp
  const shareText = `Inspección CEZ Zárate\nTitular: ${usuario.nombre}\nUsuario: #${usuario.nroUsuario}\nDomicilio: ${usuario.domicilio || "—"}\nMedidor: ${usuario.medidor || "—"}\nEstado: ${usuario.estado?.nombre || "—"}\n${tieneCoords ? `Navegación Google Maps: ${urlNavegacionGmaps}` : ""}`;
  const urlWhatsApp = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

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

        {/* Layout en 2 columnas amplias */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* COLUMNA 1: Datos Principales del Usuario y Acciones */}
          <div
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
              {tieneCoords ? (
                <a
                  href={urlNavegacionGmaps}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    background: "linear-gradient(135deg, #1e293b, #0f172a)",
                    color: "#ffffff",
                    padding: "16px 20px",
                    borderRadius: "14px",
                    fontWeight: "800",
                    fontSize: "15.5px",
                    textDecoration: "none",
                    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.25)",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  <span>Iniciar Navegación en Google Maps</span>
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
                  Este suministro no cuenta con coordenadas GPS cargadas.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: tieneCoords ? "1fr 1fr" : "1fr", gap: "10px" }}>
                {tieneCoords && (
                  <a
                    href={urlPuntoGmaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      background: "#f1f5f9",
                      color: "#0f172a",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      fontWeight: "700",
                      fontSize: "13.5px",
                      textDecoration: "none",
                      border: "1.5px solid #cbd5e1",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Ver punto Maps</span>
                  </a>
                )}

                <a
                  href={urlWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    background: "#15803d",
                    color: "#ffffff",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    fontWeight: "700",
                    fontSize: "13.5px",
                    textDecoration: "none",
                    boxShadow: "0 4px 12px rgba(21, 128, 61, 0.25)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>Compartir WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* COLUMNA 2: Galería de Fotos de Inspección */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "18px",
              padding: "26px",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.22)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                {imagenes.map((img, idx) => {
                  return (
                    <div
                      key={img.id || idx}
                      onClick={() => setSelectedImage(img)}
                      style={{
                        position: "relative",
                        aspectRatio: "1",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: "1.5px solid #e2e8f0",
                        cursor: "pointer",
                        backgroundColor: "#f1f5f9",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <Image
                        src={img.url}
                        alt={`Foto ${idx + 1}`}
                        fill
                        sizes="(max-width: 600px) 45vw, 200px"
                        style={{ objectFit: "cover" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "6px 8px",
                          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 700,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>Foto {idx + 1}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL LIGHTBOX PANTALLA COMPLETA */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
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
            onClick={() => setSelectedImage(null)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              fontSize: "20px",
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

          {/* Imagen en grande */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: "1000px", height: "75vh", maxHeight: "750px" }}
          >
            <Image
              src={selectedImage.url}
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
            {selectedImage.createdAt && (
              <span style={{ background: "rgba(255,255,255,0.15)", padding: "5px 14px", borderRadius: "20px", fontWeight: 600 }}>
                Fecha: {formatFechaImagen(selectedImage)}
              </span>
            )}
            <a
              href={selectedImage.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 700, fontSize: "13px" }}
            >
              Abrir archivo original ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
