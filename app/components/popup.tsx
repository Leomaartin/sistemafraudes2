"use client";
import "../css/popup.css";
import { useState } from "react";
import { toast } from "react-toastify";

export interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
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
        data
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
          {imagenes.map((imagen) => (
            <div className="image-card" key={imagen.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagen.url} alt="Imagen del usuario" />

             <div className="image-overlay">
                <a
                  href={imagen.url}
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
            </div>
          ))}
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
        <div
          className="confirm-delete-overlay"
          onClick={() => !eliminando && setImagenAEliminar(null)}
        >
          <div
            className="confirm-delete-card"
            onClick={(e) => e.stopPropagation()}
          >
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
                src={imagenAEliminar.url}
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
    </div>
  );
}