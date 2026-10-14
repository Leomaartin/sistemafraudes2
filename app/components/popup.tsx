"use client";

import "../css/popup.css";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";

export interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
}

function getValidImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const clean = url.trim().replace(/\\/g, "/");
  const match = clean.match(/\/img\/.+$/i);
  if (match) return match[0];
  if (clean.toLowerCase().startsWith("img/")) return `/${clean}`;
  if (clean.toLowerCase().startsWith("public/img/")) return clean.replace(/^public/i, "");
  if (!clean.includes("/") && !clean.startsWith("http") && clean.length > 0) {
    return `/img/${clean}`;
  }
  return clean;
}

export default function Popup({
  imagenes,
  setImagenes,
  usuarioId,
}: {
  imagenes: ImagenItem[];
  setImagenes: React.Dispatch<React.SetStateAction<ImagenItem[]>>;
  usuarioId: number;
}) {

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagenAEliminar, setImagenAEliminar] = useState<ImagenItem | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [imagenFullscreen, setImagenFullscreen] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [erroresCarga, setErroresCarga] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImagenFullscreen(null);
      }
    };
    if (imagenFullscreen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [imagenFullscreen]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      setSelectedImage(file);
    }
  };

  const handleSumbitImage = async () => {

    if (!selectedImage) {
      toast.warning("Por favor, selecciona una imagen antes de subirla.");
      return;
    }

    const formData = new FormData();

    formData.append("archivo", selectedImage);
    formData.append("usuarioId", String(usuarioId));

    try {

      const res = await fetch("/api/img", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        toast.error(data.error || "Error al subir la imagen");
        return;
      }

      setImagenes((imagenesActuales) => [
        ...imagenesActuales,
        { ...data, url: getValidImageUrl(data.url) }
      ]);

      setSelectedImage(null);
      toast.success("¡Imagen subida correctamente!");

    } catch (error) {
      console.error("Error al subir imagen:", error);
      toast.error("Ocurrió un error al subir la imagen");
    }
  };

  const handleConfirmarEliminacion = async () => {
    if (!imagenAEliminar) return;

    setEliminando(true);
    try {
      const res = await fetch(`/api/img?usuarioId=${usuarioId}&imagenId=${imagenAEliminar.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error al eliminar imagen:", errorData);
        toast.error(errorData.error || "Error al eliminar la imagen");
        return;
      }

      setImagenes((imagenesActuales) => imagenesActuales.filter((img) => img.id !== imagenAEliminar.id));
      toast.success("Imagen eliminada correctamente");
      setImagenAEliminar(null);
    } catch (error) {
      console.error("Error al eliminar imagen:", error);
      toast.error("Ocurrió un error al eliminar la imagen");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="popup-body">
      <h3>Imágenes</h3>

      {imagenes.length === 0 ? (
        <p>Este usuario no tiene imágenes.</p>
      ) : (
        <div className="images-container">
          {imagenes.map((imagen) => {
            const validUrl = getValidImageUrl(imagen.url);
            return (
              <div className="image-card" key={imagen.id}>
                {erroresCarga[imagen.id] ? (
                  <div className="image-error-card">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="image-error-title">No encontrada en servidor</span>
                    <span className="image-error-filename" title={validUrl}>{validUrl.split("/").pop()}</span>
                    <button
                      type="button"
                      className="image-error-del-btn"
                      onClick={() => setImagenAEliminar(imagen)}
                      title="Eliminar este registro huérfano"
                    >
                      Eliminar
                    </button>
                  </div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={validUrl}
                      alt="Imagen del usuario"
                      onClick={() => setImagenFullscreen(validUrl)}
                      onError={() => {
                        console.warn("No se pudo cargar la imagen:", validUrl);
                        setErroresCarga((prev) => ({ ...prev, [imagen.id]: true }));
                      }}
                      style={{ cursor: "zoom-in" }}
                    />

                    <div className="image-overlay">
                      <button
                        type="button"
                        className="action-btn expand-btn"
                        title="Agrandar imagen (Pantalla completa)"
                        onClick={() => setImagenFullscreen(validUrl)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        className="action-btn download-btn"
                        title="Descargar"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>

                      <button
                        type="button"
                        className="action-btn delete-btn"
                        title="Eliminar imagen"
                        onClick={() => setImagenAEliminar(imagen)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
          );
        })}
        </div>
      )}

      <div className="add-image-button">
        <input
          type="file"
          accept="image/*"
          onChange={handleImage}
        />

        <button
          onClick={handleSumbitImage}
          className="add-image-btn"
        >
          <span className="add-icon">+</span>
          Agregar imagen
        </button>
      </div>

      {/* POPUP LINDO DE CONFIRMACIÓN PARA ELIMINAR IMAGEN */}
      {imagenAEliminar && (
        <div className="confirm-delete-overlay">
          <div
            className="confirm-delete-card"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="modal-close-icon"
              onClick={() => !eliminando && setImagenAEliminar(null)}
              title="Cerrar"
              style={{ position: "absolute", top: "12px", right: "12px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="confirm-delete-icon-box">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h4 className="confirm-delete-title">¿Eliminar esta imagen?</h4>
            <p className="confirm-delete-message">
              ¿Estás seguro de que deseas eliminar la imagen? Esta acción es definitiva y no se puede deshacer.
            </p>

            {/* Vista previa en miniatura de la imagen que se eliminará */}
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
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-delete-btn-confirm"
                onClick={handleConfirmarEliminacion}
                disabled={eliminando}
              >
                {eliminando ? (
                  <>
                    <span className="spinner-confirm-del" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

      {/* MODAL FULLSCREEN DE IMAGEN (OCUPA TODA LA PANTALLA) */}
      {mounted && imagenFullscreen && createPortal(
        <div className="fullscreen-image-overlay">
          <div className="fullscreen-top-bar" onClick={(e) => e.stopPropagation()}>
            <a
              href={getValidImageUrl(imagenFullscreen)}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="fullscreen-btn"
              title="Descargar imagen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>

            <button
              type="button"
              className="fullscreen-btn fullscreen-close-btn"
              onClick={() => setImagenFullscreen(null)}
              title="Cerrar pantalla completa (Esc)"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
              src={getValidImageUrl(imagenFullscreen)}
              alt="Imagen en pantalla completa"
              className="fullscreen-img"
            />
          </div>

          <div className="fullscreen-hint">
            Presioná la <strong>cruz ✕</strong> o <strong>ESC</strong> para salir de pantalla completa
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}