"use client";
import "../css/popup.css";
import { useState } from "react";

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

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      setSelectedImage(file);
    }
  };

  const handleSumbitImage = async () => {

    if (!selectedImage) {
      alert("Por favor, selecciona una imagen antes de subirla.");
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
        return;
      }

      setImagenes((imagenesActuales) => [
        ...imagenesActuales,
        data
      ]);

      setSelectedImage(null);

    } catch (error) {
      console.error("Error al subir imagen:", error);
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
                  className="action-btn delete-btn"
                  title="Eliminar"
                  onClick={async () => {
                    try {
                      const res = await fetch(  `/api/img?usuarioId=${usuarioId}&imagenId=${imagen.id}`, {
                        method: "DELETE",
                      });

                      if (!res.ok) {
                        console.error("Error al eliminar imagen:", await res.json());
                        return;
                      }

                      setImagenes((imagenesActuales) => imagenesActuales.filter((img) => img.id !== imagen.id));
                    } catch (error) {
                      console.error("Error al eliminar imagen:", error);
                    }
                  }}
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
    </div>
  );
}