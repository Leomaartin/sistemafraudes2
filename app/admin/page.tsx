"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../css/cuadrilla.css";
import CrudUsers, { CatalogoItem } from "../components/crudUsers";

type CatalogType = "cuadrilla" | "estado" | "tarifa";

interface CatalogCardProps {
  title: string;
  type: CatalogType;
  items: CatalogoItem[];
  icon: React.ReactNode;
  colorTheme: "blue" | "emerald" | "amber";
  emptyMessage: string;
  onAdd: () => void;
  onEdit: (item: CatalogoItem) => void;
  onDelete: (item: CatalogoItem) => void;
}

function DropdownCatalogCard({
  title,
  items,
  icon,
  colorTheme,
  emptyMessage,
  onAdd,
  onEdit,
  onDelete,
}: CatalogCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter((item) =>
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const activeItem = items.find((i) => i.id === selectedId) || items[0] || null;

  return (
    <div className={`catalog-card theme-${colorTheme}`}>
      <div className="card-top-bar">
        <div className="card-icon-title">
          <div className="card-icon">{icon}</div>
          <div>
            <h3 className="card-title">{title}</h3>
            <span className="card-counter">
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn-add-item"
          onClick={onAdd}
          title={`Agregar nueva opción a ${title}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Agregar</span>
        </button>
      </div>

      {/* Menú Desplegable Principal */}
      <div className="dropdown-section">
        <label className="dropdown-label">Opciones desplegables:</label>

        <div className="custom-dropdown">
          <button
            type="button"
            className={`dropdown-trigger ${isOpen ? "is-active" : ""}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
          >
            <div className="trigger-content">
              <span className="trigger-bullet">•</span>
              <span className="trigger-text">
                {activeItem
                  ? `${activeItem.nombre} (ID: ${activeItem.id})`
                  : emptyMessage}
              </span>
            </div>
            <svg
              className={`chevron-icon ${isOpen ? "rotate" : ""}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {isOpen && (
            <div className="dropdown-menu-panel">
              {items.length > 4 && (
                <div className="dropdown-search">
                  <input
                    type="text"
                    placeholder={`Buscar en ${title.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              <ul className="dropdown-list">
                {filteredItems.length === 0 ? (
                  <li className="dropdown-empty">
                    {searchTerm ? "No se encontraron coincidencias" : emptyMessage}
                  </li>
                ) : (
                  filteredItems.map((item) => (
                    <li
                      key={item.id}
                      className={`dropdown-item ${selectedId === item.id ? "selected" : ""
                        }`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setIsOpen(false);
                      }}
                    >
                      <div className="item-info">
                        <span className="item-name">{item.nombre}</span>
                        <span className="item-id">ID: #{item.id}</span>
                      </div>

                      {/* Botones de acción CRUD para cada ítem */}
                      <div
                        className="item-crud-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn-item-action btn-item-edit"
                          onClick={() => {
                            setIsOpen(false);
                            onEdit(item);
                          }}
                          title={`Editar ${item.nombre}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-item-action btn-item-delete"
                          onClick={() => {
                            setIsOpen(false);
                            onDelete(item);
                          }}
                          title={`Eliminar ${item.nombre}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [cuadrillas, setCuadrillas] = useState<CatalogoItem[]>([]);
  const [estado, setEstado] = useState<CatalogoItem[]>([]);
  const [tarifa, setTarifa] = useState<CatalogoItem[]>([]);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados para CRUD de catálogos (Cuadrilla / Estado / Tarifa)
  const [catalogModal, setCatalogModal] = useState<{
    isOpen: boolean;
    type: CatalogType;
    isEditing: boolean;
    item: CatalogoItem | null;
    nombre: string;
    submitting: boolean;
  }>({
    isOpen: false,
    type: "cuadrilla",
    isEditing: false,
    item: null,
    nombre: "",
    submitting: false,
  });

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: CatalogType;
    item: CatalogoItem | null;
    submitting: boolean;
  }>({
    isOpen: false,
    type: "cuadrilla",
    item: null,
    submitting: false,
  });

  const getEndpoint = (type: CatalogType) => {
    switch (type) {
      case "cuadrilla":
        return "/api/cuadrillasapi";
      case "estado":
        return "/api/estadosapi";
      case "tarifa":
        return "/api/tarifasapi";
    }
  };

  const getTypeName = (type: CatalogType) => {
    switch (type) {
      case "cuadrilla":
        return "Cuadrilla";
      case "estado":
        return "Estado";
      case "tarifa":
        return "Tarifa";
    }
  };

  const fetchCatalogos = async () => {
    setLoading(true);
    try {
      const [resCuadrillas, resEstados, resTarifas] = await Promise.all([
        fetch("/api/cuadrillasapi"),
        fetch("/api/estadosapi"),
        fetch("/api/tarifasapi"),
      ]);

      if (resCuadrillas.ok) setCuadrillas(await resCuadrillas.json());
      if (resEstados.ok) setEstado(await resEstados.json());
      if (resTarifas.ok) setTarifa(await resTarifas.json());
    } catch (error) {
      console.error("Error al cargar catálogos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [resCuadrillas, resEstados, resTarifas] = await Promise.all([
          fetch("/api/cuadrillasapi"),
          fetch("/api/estadosapi"),
          fetch("/api/tarifasapi"),
        ]);
        if (isMounted) {
          if (resCuadrillas.ok) setCuadrillas(await resCuadrillas.json());
          if (resEstados.ok) setEstado(await resEstados.json());
          if (resTarifas.ok) setTarifa(await resTarifas.json());
        }
      } catch (error) {
        console.error("Error al cargar catálogos:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Manejadores CRUD Catálogos
  const openCreateCatalog = (type: CatalogType) => {
    setCatalogModal({
      isOpen: true,
      type,
      isEditing: false,
      item: null,
      nombre: "",
      submitting: false,
    });
  };

  const openEditCatalog = (type: CatalogType, item: CatalogoItem) => {
    setCatalogModal({
      isOpen: true,
      type,
      isEditing: true,
      item,
      nombre: item.nombre,
      submitting: false,
    });
  };

  const handleSaveCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = catalogModal.nombre.trim();
    const typeLabel = getTypeName(catalogModal.type);

    if (!nombre) {
      toast.warning(`El nombre de ${typeLabel.toLowerCase()} no puede estar vacío.`);
      return;
    }

    setCatalogModal((prev) => ({ ...prev, submitting: true }));
    const endpoint = getEndpoint(catalogModal.type);

    try {
      const isEditing = catalogModal.isEditing;
      const res = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? { id: catalogModal.item?.id, nombre }
            : { nombre }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || `Error al guardar ${typeLabel.toLowerCase()}.`);
        setCatalogModal((prev) => ({ ...prev, submitting: false }));
        return;
      }

      toast.success(
        isEditing
          ? `${typeLabel} actualizada correctamente.`
          : `${typeLabel} agregada exitosamente.`
      );

      setCatalogModal({
        isOpen: false,
        type: "cuadrilla",
        isEditing: false,
        item: null,
        nombre: "",
        submitting: false,
      });

      fetchCatalogos();
    } catch (error) {
      console.error("Error al guardar catálogo:", error);
      toast.error("Ocurrió un error inesperado al conectar con el servidor.");
      setCatalogModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const openDeleteCatalog = (type: CatalogType, item: CatalogoItem) => {
    setDeleteModal({
      isOpen: true,
      type,
      item,
      submitting: false,
    });
  };

  const handleConfirmDeleteCatalog = async () => {
    if (!deleteModal.item) return;
    const typeLabel = getTypeName(deleteModal.type);
    setDeleteModal((prev) => ({ ...prev, submitting: true }));

    const endpoint = `${getEndpoint(deleteModal.type)}?id=${deleteModal.item.id}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || `Error al eliminar ${typeLabel.toLowerCase()}.`);
        setDeleteModal((prev) => ({ ...prev, submitting: false }));
        return;
      }

      toast.success(`${typeLabel} eliminada correctamente.`);
      setDeleteModal({
        isOpen: false,
        type: "cuadrilla",
        item: null,
        submitting: false,
      });

      fetchCatalogos();
    } catch (error) {
      console.error("Error al eliminar catálogo:", error);
      toast.error("Ocurrió un error inesperado al eliminar.");
      setDeleteModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  return (
    <main className="admin-shell">
      {/* Notificaciones Toast */}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <div className="admin-wrapper">
        {/* Barra Superior / Header */}
        <header className="admin-header">
          <div className="header-left">
            <Link href="/usuarios" className="btn-back">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Volver a Usuarios</span>
            </Link>

            <div className="header-titles">
              <h1 className="main-title">Panel de Control</h1>
              <p className="main-subtitle">
                Gestión de cuadrillas, estados, tarifas y alta de usuarios con irregularidades.
              </p>
            </div>
          </div>

          <div className="header-actions">

            <button
              className="btn-primary-action"
              type="button"
              onClick={() => setShowAddPopup(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Agregar Nuevo Usuario</span>
            </button>
          </div>
        </header>

        {/* Resumen Métrico */}
        <section className="metrics-strip">
          <div className="metric-box">
            <div className="metric-icon-wrap icon-blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="metric-details">
              <span className="metric-number">{cuadrillas.length}</span>
              <span className="metric-label">Cuadrillas Registradas</span>
            </div>
          </div>

          <div className="metric-box">
            <div className="metric-icon-wrap icon-emerald">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="metric-details">
              <span className="metric-number">{estado.length}</span>
              <span className="metric-label">Estados de Fraude</span>
            </div>
          </div>

          <div className="metric-box">
            <div className="metric-icon-wrap icon-amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="metric-details">
              <span className="metric-number">{tarifa.length}</span>
              <span className="metric-label">Tarifas Configuradas</span>
            </div>
          </div>
        </section>

        {/* Sección de Tarjetas con Menús Desplegables y CRUD */}
        <section className="catalog-grid">
          {/* Cuadrillas */}
          <DropdownCatalogCard
            title="Cuadrillas"
            type="cuadrilla"
            items={cuadrillas}
            colorTheme="blue"
            emptyMessage="Sin cuadrillas registradas"
            onAdd={() => openCreateCatalog("cuadrilla")}
            onEdit={(item) => openEditCatalog("cuadrilla", item)}
            onDelete={(item) => openDeleteCatalog("cuadrilla", item)}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            }
          />

          {/* Estados */}
          <DropdownCatalogCard
            title="Estados"
            type="estado"
            items={estado}
            colorTheme="emerald"
            emptyMessage="Sin estados registrados"
            onAdd={() => openCreateCatalog("estado")}
            onEdit={(item) => openEditCatalog("estado", item)}
            onDelete={(item) => openDeleteCatalog("estado", item)}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            }
          />

          {/* Tarifas */}
          <DropdownCatalogCard
            title="Tarifas"
            type="tarifa"
            items={tarifa}
            colorTheme="amber"
            emptyMessage="Sin tarifas registradas"
            onAdd={() => openCreateCatalog("tarifa")}
            onEdit={(item) => openEditCatalog("tarifa", item)}
            onDelete={(item) => openDeleteCatalog("tarifa", item)}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            }
          />
        </section>


      </div>

      {/* Modal / Popup de Creación de Usuario */}
      {showAddPopup && (
        <div className="popup-overlay" onClick={() => setShowAddPopup(false)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-icon"
              onClick={() => setShowAddPopup(false)}
              title="Cerrar modal"
              aria-label="Cerrar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <CrudUsers
              cuadrillas={cuadrillas}
              estados={estado}
              tarifas={tarifa}
              onClose={() => setShowAddPopup(false)}
              onUserCreated={fetchCatalogos}
            />
          </div>
        </div>
      )}

      {/* Modal para Crear / Editar Catálogo (Cuadrilla / Estado / Tarifa) */}
      {catalogModal.isOpen && (
        <div
          className="popup-overlay"
          onClick={() =>
            setCatalogModal((prev) => ({ ...prev, isOpen: false }))
          }
        >
          <div
            className="popup-content catalog-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-icon"
              onClick={() =>
                setCatalogModal((prev) => ({ ...prev, isOpen: false }))
              }
              title="Cerrar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="modal-header-simple">
              <h3 className="modal-simple-title">
                {catalogModal.isEditing ? "Editar" : "Agregar"}{" "}
                {getTypeName(catalogModal.type)}
              </h3>
              <p className="modal-simple-subtitle">
                {catalogModal.isEditing
                  ? `Modifica el nombre de la opción seleccionada.`
                  : `Ingresa el nombre para dar de alta la nueva opción.`}
              </p>
            </div>

            <form onSubmit={handleSaveCatalog} className="catalog-simple-form">
              <div className="input-group">
                <label htmlFor="catalogNombre">
                  Nombre de {getTypeName(catalogModal.type)} *
                </label>
                <input
                  id="catalogNombre"
                  type="text"
                  placeholder={`Ej: ${catalogModal.type === "cuadrilla"
                    ? "Cuadrilla Noroeste"
                    : catalogModal.type === "estado"
                      ? "En Investigación"
                      : "Tarifa Comercial Especial"
                    }`}
                  value={catalogModal.nombre}
                  onChange={(e) =>
                    setCatalogModal((prev) => ({
                      ...prev,
                      nombre: e.target.value,
                    }))
                  }
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions-simple">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() =>
                    setCatalogModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  disabled={catalogModal.submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={catalogModal.submitting}
                >
                  {catalogModal.submitting ? "Guardando..." : "Guardar Opción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Confirmar Eliminación */}
      {deleteModal.isOpen && deleteModal.item && (
        <div
          className="popup-overlay"
          onClick={() =>
            setDeleteModal((prev) => ({ ...prev, isOpen: false }))
          }
        >
          <div
            className="popup-content catalog-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-simple">
              <div className="delete-icon-alert">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="modal-simple-title">
                ¿Eliminar {getTypeName(deleteModal.type)}?
              </h3>
              <p className="modal-simple-subtitle">
                Estás a punto de eliminar <strong>&quot;{deleteModal.item.nombre}&quot;</strong> (ID: #{deleteModal.item.id}).
                Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="modal-actions-simple">
              <button
                type="button"
                className="btn-cancel"
                onClick={() =>
                  setDeleteModal((prev) => ({ ...prev, isOpen: false }))
                }
                disabled={deleteModal.submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-delete-confirm"
                onClick={handleConfirmDeleteCatalog}
                disabled={deleteModal.submitting}
              >
                {deleteModal.submitting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}