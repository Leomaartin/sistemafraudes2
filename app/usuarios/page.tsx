"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../css/usuarios.css";
import Popup from "../components/popup";
import PopupEdit from "../components/popupedit";
import * as XLSX from "xlsx";

export interface CatalogoItem {
  id: number;
  nombre: string;
}

export interface ImagenItem {
  id: number;
  url: string;
  usuarioId: number;
}

export interface UsuarioItem {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string | null;
  medidor: string | null;
  ruta: string | null;
  observaciones: string | null;
  maps: string | null;
  idEstado: number | null;
  idTarifa: number | null;
  cuadrillas?: CatalogoItem[];
  estado?: CatalogoItem | null;
  tarifa?: CatalogoItem | null;
  imagenes?: ImagenItem[];
}

export default function Home() {
  const [allUsers, setAllUsers] = useState<UsuarioItem[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioItem | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [imagenes, setImagenes] = useState<ImagenItem[]>([]);
  const [showPopupEdit, setShowPopupEdit] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioItem | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Estados de filtros
  const [searchName, setSearchName] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [searchDomicilio, setSearchDomicilio] = useState("");
  const [searchRuta, setSearchRuta] = useState("");
  const [cuadrillas, setCuadrillas] = useState<CatalogoItem[]>([]);
  const [searchCuadrilla, setSearchCuadrilla] = useState("");
  const [estados, setEstados] = useState<CatalogoItem[]>([]);
  const [searchEstados, setSearchEstados] = useState("");
  const [tarifas, setTarifas] = useState<CatalogoItem[]>([]);
  const [searchTarifas, setSearchTarifas] = useState("");

  // Control del menú desplegable de filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Funcion exportar excel
  const exportarExcel = () => {
    const datos = filteredUsers.map((user) => ({
      "N° Usuario": user.nroUsuario,
      "Nombre": user.nombre,
      "Domicilio": user.domicilio || "",
      "Medidor": user.medidor || "",
      "Ruta": user.ruta || "",
      "Estado": user.estado?.nombre || "",
      "Cuadrillas": user.cuadrillas?.map((c) => c.nombre).join(", ") || "",
      "Tarifa": user.tarifa?.nombre || "",
      "Google Maps": user.maps || "",
      "Observaciones": user.observaciones || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Usuarios");

    XLSX.writeFile(workbook, "usuarios_filtrados.xlsx");
  };

  // Función para recargar los usuarios tras editar o eliminar
  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/usuariosapi");
      if (!res.ok) {
        throw new Error("Error al obtener la lista de usuarios");
      }
      const users: UsuarioItem[] = await res.json();
      setAllUsers(users);
    } catch (error: unknown) {
      console.error("Error fetching users:", error);
    }
  }, []);

  // Carga inicial unificada
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [resUsers, resCuadrillas, resEstados, resTarifas] = await Promise.all([
          fetch("/api/usuariosapi"),
          fetch("/api/cuadrillasapi"),
          fetch("/api/estadosapi"),
          fetch("/api/tarifasapi"),
        ]);

        if (resUsers.ok) {
          const dataUsers: UsuarioItem[] = await resUsers.json();
          if (isMounted) setAllUsers(dataUsers);
        }

        if (resCuadrillas.ok) {
          const dataCuadrillas: CatalogoItem[] = await resCuadrillas.json();
          if (isMounted) setCuadrillas(dataCuadrillas);
        }

        if (resEstados.ok) {
          const dataEstados: CatalogoItem[] = await resEstados.json();
          if (isMounted) setEstados(dataEstados);
        }

        if (resTarifas.ok) {
          const dataTarifas: CatalogoItem[] = await resTarifas.json();
          if (isMounted) setTarifas(dataTarifas);
        }
      } catch (error: unknown) {
        console.error("Error al cargar datos iniciales:", error);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const ejecutarEliminar = async () => {
    if (!usuarioAEliminar) return;

    setEliminando(true);
    try {
      const res = await fetch(`/api/users?id=${usuarioAEliminar.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar el usuario");
      }

      toast.success(`Usuario "${usuarioAEliminar.nombre}" eliminado correctamente`);
      setUsuarioAEliminar(null);
      fetchAllUsers();
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : "Error al eliminar el usuario";
      console.error("Error eliminando usuario:", error);
      toast.error(mensaje);
    } finally {
      setEliminando(false);
    }
  };

  const abrirPopup = async (usuarioId: number) => {
    try {
      const usuario = allUsers.find((user) => user.id === usuarioId);
      setUsuarioSeleccionado(usuario || null);
      setShowPopup(true);

      const res = await fetch(`/api/img?usuarioId=${usuarioId}`);
      if (!res.ok) {
        throw new Error("Error al obtener las imágenes");
      }
      const data: ImagenItem[] = await res.json();
      setImagenes(data);
    } catch (error: unknown) {
      console.error("Error obteniendo imágenes:", error);
    }
  };

  const abrirPopupEdit = (usuarioId: number) => {
    const usuario = allUsers.find((user) => user.id === usuarioId);
    if (usuario) {
      setUsuarioSeleccionado(usuario);
    } else {
      setUsuarioSeleccionado({
        id: usuarioId,
        nroUsuario: "",
        nombre: "",
        domicilio: null,
        medidor: null,
        ruta: null,
        observaciones: null,
        maps: null,
        idEstado: null,
        idTarifa: null,
      });
    }
    setShowPopupEdit(true);
  };

  const cerrarPopup = () => {
    setShowPopup(false);
    setImagenes([]);
  };

  const cerrarPopupEdit = () => {
    setShowPopupEdit(false);
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setSearchName("");
    setSearchNumber("");
    setSearchDomicilio("");
    setSearchRuta("");
    setSearchCuadrilla("");
    setSearchEstados("");
    setSearchTarifas("");
  };

  // Conteo de filtros activos
  const activeFiltersCount = [
    searchName,
    searchNumber,
    searchDomicilio,
    searchRuta,
    searchCuadrilla,
    searchEstados,
    searchTarifas,
  ].filter((val) => val.trim() !== "").length;

  const filteredUsers = allUsers.filter((user) =>
    (user.nombre || "").toLowerCase().includes(searchName.toLowerCase()) &&
    (user.nroUsuario || "").toString().includes(searchNumber) &&
    (user.domicilio || "").toLowerCase().includes(searchDomicilio.toLowerCase()) &&
    (user.ruta || "").toLowerCase().includes(searchRuta.toLowerCase()) &&
    (searchCuadrilla === "" || (user.cuadrillas && user.cuadrillas.some((c) => c.nombre === searchCuadrilla))) &&
    (searchTarifas === "" || user.tarifa?.nombre === searchTarifas) &&
    (searchEstados === "" || user.estado?.nombre === searchEstados)
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchName(e.target.value);
  };
  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchNumber(e.target.value);
  };
  const handleDomicilio = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchDomicilio(e.target.value);
  };
  const handleRuta = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchRuta(e.target.value);
  };

  return (
    <div>
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

      <main>
        <h3>
          Sistema de Gestión de Deudas y Usuarios
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Botón de Excel con logo oficial de Excel */}
            <button
              onClick={exportarExcel}
              className="btn-exportar-excel"
              title="Exportar usuarios filtrados a Excel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="#ffffff" fillOpacity="0.25"/>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#ffffff" strokeWidth="2"/>
                <path d="M14 2v6h6" stroke="#ffffff" strokeWidth="2"/>
                <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
              <span>Exportar Excel</span>
            </button>
            <Link href="/admin" className="administrar-button">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              Administrar
            </Link>
          </div>
        </h3>

        {/* Sección de Filtros */}
        <div className="search-container">
          <div className="filtros-control-bar">
            {/* Input de búsqueda rápida */}
            <div className="search-quick-box">
              <svg
                className="search-quick-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="search-quick-input"
                type="text"
                placeholder="Buscar rápido por nombre..."
                value={searchName}
                onChange={handleSearch}
              />
              {searchName && (
                <button
                  type="button"
                  className="btn-quick-clear"
                  onClick={() => setSearchName("")}
                  title="Borrar búsqueda"
                  aria-label="Borrar búsqueda"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Botón para desplegar el menú de filtros */}
            <button
              type="button"
              className={`btn-toggle-filtros ${mostrarFiltros ? "active" : ""}`}
              onClick={() => setMostrarFiltros((prev) => !prev)}
              aria-expanded={mostrarFiltros}
              title="Mostrar u ocultar opciones de filtrado"
            >
              <svg
                className="icon-funnel"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="badge-active-count">{activeFiltersCount}</span>
              )}
              <svg
                className={`icon-chevron ${mostrarFiltros ? "rotated" : ""}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Botón para limpiar todos los filtros */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn-limpiar-filtros"
                onClick={limpiarFiltros}
                title="Limpiar todos los filtros"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Menú desplegable de filtros */}
          <div className={`filtros ${mostrarFiltros ? "filtros-open" : "filtros-closed"}`}>
            <div className="filtros-header">
              <div className="filtros-header-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span className="filtros-header-title">Filtros de búsqueda</span>
                {activeFiltersCount > 0 && (
                  <span className="filtros-header-tag">
                    {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  className="filtros-header-reset-btn"
                  onClick={limpiarFiltros}
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            <div className="filtros-grid">
              {/* Filtro: Nombre */}
              <div className={`filtro-field ${searchName ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-nombre">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Nombre
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-nombre"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchName}
                    onChange={handleSearch}
                  />
                  {searchName && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchName("")}
                      aria-label="Limpiar nombre"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro: Número */}
              <div className={`filtro-field ${searchNumber ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-numero">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="9" x2="20" y2="9" />
                    <line x1="4" y1="15" x2="20" y2="15" />
                    <line x1="10" y1="3" x2="8" y2="21" />
                    <line x1="16" y1="3" x2="14" y2="21" />
                  </svg>
                  N° Usuario
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-numero"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por número..."
                    value={searchNumber}
                    onChange={handleNumber}
                  />
                  {searchNumber && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchNumber("")}
                      aria-label="Limpiar número"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro: Domicilio */}
              <div className={`filtro-field ${searchDomicilio ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-domicilio">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Domicilio
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-domicilio"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por domicilio..."
                    value={searchDomicilio}
                    onChange={handleDomicilio}
                  />
                  {searchDomicilio && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchDomicilio("")}
                      aria-label="Limpiar domicilio"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro: Ruta */}
              <div className={`filtro-field ${searchRuta ? "has-value" : ""}`}>
                <label htmlFor="filtro-input-ruta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  Ruta
                </label>
                <div className="filtro-input-wrap">
                  <input
                    id="filtro-input-ruta"
                    className="search-input"
                    type="text"
                    placeholder="Buscar por ruta..."
                    value={searchRuta}
                    onChange={handleRuta}
                  />
                  {searchRuta && (
                    <button
                      type="button"
                      className="btn-field-clear"
                      onClick={() => setSearchRuta("")}
                      aria-label="Limpiar ruta"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro: Cuadrilla */}
              <div className={`filtro-field ${searchCuadrilla ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-cuadrilla">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Cuadrilla
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-cuadrilla"
                    className="filtro-select"
                    value={searchCuadrilla}
                    onChange={(e) => setSearchCuadrilla(e.target.value)}
                  >
                    <option value="">Todas las cuadrillas</option>
                    {cuadrillas.map((cuadrilla) => (
                      <option key={cuadrilla.id} value={cuadrilla.nombre}>
                        {cuadrilla.nombre}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Filtro: Estados */}
              <div className={`filtro-field ${searchEstados ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-estado">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                  Estado
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-estado"
                    className="filtro-select"
                    value={searchEstados}
                    onChange={(e) => setSearchEstados(e.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    {estados.map((estado) => (
                      <option key={estado.id} value={estado.nombre}>
                        {estado.nombre}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Filtro: Tarifas */}
              <div className={`filtro-field ${searchTarifas ? "has-value" : ""}`}>
                <label htmlFor="filtro-select-tarifa">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Tarifa
                </label>
                <div className="select-dropdown-wrap">
                  <select
                    id="filtro-select-tarifa"
                    className="filtro-select"
                    value={searchTarifas}
                    onChange={(e) => setSearchTarifas(e.target.value)}
                  >
                    <option value="">Todas las tarifas</option>
                    {tarifas.map((tarifa) => (
                      <option key={tarifa.id} value={tarifa.nombre}>
                        {tarifa.nombre}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="select-chevron-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="filtros-footer">
              <span className="filtros-count-indicator">
                Mostrando <strong>{filteredUsers.length}</strong> de <strong>{allUsers.length}</strong> usuarios
              </span>
              <div className="filtros-footer-buttons">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="btn-footer-clear"
                    onClick={limpiarFiltros}
                  >
                    Limpiar todo
                  </button>
                )}
                <button
                  type="button"
                  className="btn-footer-close"
                  onClick={() => setMostrarFiltros(false)}
                >
                  Cerrar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Chips de filtros activos */}
          <div className="filtros-status-bar">
            <div className="filtros-status-count">
              <span>{filteredUsers.length} {filteredUsers.length === 1 ? "usuario encontrado" : "usuarios encontrados"}</span>
            </div>

            {activeFiltersCount > 0 && (
              <div className="filtros-active-chips">
                {searchName && (
                  <span className="filtro-chip">
                    Nombre: <strong>{searchName}</strong>
                    <button type="button" onClick={() => setSearchName("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchNumber && (
                  <span className="filtro-chip">
                    N°: <strong>{searchNumber}</strong>
                    <button type="button" onClick={() => setSearchNumber("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchDomicilio && (
                  <span className="filtro-chip">
                    Domicilio: <strong>{searchDomicilio}</strong>
                    <button type="button" onClick={() => setSearchDomicilio("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchRuta && (
                  <span className="filtro-chip">
                    Ruta: <strong>{searchRuta}</strong>
                    <button type="button" onClick={() => setSearchRuta("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchCuadrilla && (
                  <span className="filtro-chip">
                    Cuadrilla: <strong>{searchCuadrilla}</strong>
                    <button type="button" onClick={() => setSearchCuadrilla("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchEstados && (
                  <span className="filtro-chip">
                    Estado: <strong>{searchEstados}</strong>
                    <button type="button" onClick={() => setSearchEstados("")} title="Quitar filtro">×</button>
                  </span>
                )}
                {searchTarifas && (
                  <span className="filtro-chip">
                    Tarifa: <strong>{searchTarifas}</strong>
                    <button type="button" onClick={() => setSearchTarifas("")} title="Quitar filtro">×</button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mensaje de no resultados */}
        {filteredUsers.length === 0 && (
          <div className="empty-results-box">
            <div className="empty-results-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <h4>No se encontraron usuarios</h4>
            <p>No existen registros que coincidan con los criterios de búsqueda aplicados.</p>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn-empty-reset"
                onClick={limpiarFiltros}
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}

        {/* Lista Vertical de Usuarios (Renglones/Filas: Uno abajo del otro) */}
        <section className="user-list-container">
          {filteredUsers.map((user) => (
            <div className="user-list-row" key={user.id}>

              {/* N° + Nombre */}
              <div className="row-col-main">
                <span className="val-user-nro">N° {user.nroUsuario}</span>
                <span className="row-user-name">{user.nombre}</span>
              </div>

              {/* Domicilio — EN NEGRO */}
              <div className="row-col-item">
                <span className="label-mini">Domicilio</span>
                <span className="val-domicilio">{user.domicilio || "—"}</span>
              </div>

              {/* Estado — SIN FONDO */}
              <div className="row-col-item">
                <span className="label-mini">Estado</span>
                <span className="val-estado-texto">
                  {user.estado?.nombre || "—"}
                </span>
              </div>

              {/* Ruta — SOLO LETRA EN AZUL */}
              <div className="row-col-item">
                <span className="label-mini">Ruta</span>
                <span className="val-ruta">{user.ruta || "—"}</span>
              </div>

              {/* Google Maps — SOLO LETRA EN ROJO */}
              <div className="row-col-item">
                <span className="label-mini">Ubicación</span>
                {user.maps ? (
                  <a
                    href={user.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="maps-link-rojo"
                  >
                    Ir a Google Maps
                  </a>
                ) : (
                  <span className="val-no-maps">—</span>
                )}
              </div>

              {/* Medidor y Tarifa */}
              <div className="row-col-item">
                <span className="label-mini">Medidor / Tarifa</span>
                {user.medidor ? (
                  <span className="val-medidor">{user.medidor}</span>
                ) : (
                  <span className="val-no-maps">—</span>
                )}
                <span className="val-tarifa">{user.tarifa?.nombre || "—"}</span>
              </div>

              {/* Cuadrillas */}
              <div className="row-col-item">
                <span className="label-mini">Cuadrillas</span>
                <div className="cuadrillas-chips-container">
                  {user.cuadrillas && user.cuadrillas.length > 0 ? (
                    user.cuadrillas.map((c) => (
                      <span key={c.id} className="chip-cuadrilla">{c.nombre}</span>
                    ))
                  ) : (
                    <span className="val-no-maps">—</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="row-col-actions">
                <button
                  type="button"
                  className="btn-action-text btn-edit-text"
                  onClick={() => abrirPopupEdit(user.id)}
                  title="Editar usuario"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="btn-action-text btn-delete-text"
                  onClick={() => setUsuarioAEliminar(user)}
                  title="Eliminar usuario"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Eliminar</span>
                </button>

                <button
                  type="button"
                  className="btn-view-images-row"
                  onClick={() => abrirPopup(user.id)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                  <span>Imágenes</span>
                </button>
              </div>

              {/* Observaciones — pie de card, ancho completo */}
              {user.observaciones && (
                <div className="row-obs-footer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
                  </svg>
                  <span><strong>Observaciones:</strong> {user.observaciones}</span>
                </div>
              )}

            </div>
          ))}

          {/* Modal Ver Imágenes */}
          {showPopup && usuarioSeleccionado && (
            <div className="popup-overlay" onClick={cerrarPopup}>
              <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                <Popup
                  imagenes={imagenes}
                  setImagenes={setImagenes}
                  usuarioId={usuarioSeleccionado.id}
                />
                <button className="close-button" onClick={cerrarPopup}>
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Modal Editar Usuario */}
          {showPopupEdit && usuarioSeleccionado && (
            <div className="popup-overlay" onClick={cerrarPopupEdit}>
              <div
                className="popup-content popup-edit-content"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="modal-close-icon"
                  onClick={cerrarPopupEdit}
                  title="Cerrar modal"
                  aria-label="Cerrar"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <PopupEdit
                  usuarioId={usuarioSeleccionado.id}
                  onClose={cerrarPopupEdit}
                  onUserUpdated={() => {
                    fetchAllUsers();
                    cerrarPopupEdit();
                  }}
                />
              </div>
            </div>
          )}

          {/* Modal Eliminar Usuario */}
          {usuarioAEliminar && (
            <div
              className="popup-overlay"
              onClick={() => !eliminando && setUsuarioAEliminar(null)}
            >
              <div
                className="popup-content delete-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="delete-modal-header">
                  <div className="delete-modal-icon">
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h3 className="delete-modal-title">¿Eliminar usuario?</h3>
                  <p className="delete-modal-text">
                    Estás a punto de eliminar a <strong>&quot;{usuarioAEliminar.nombre}&quot;</strong> (Nro: #{usuarioAEliminar.nroUsuario}).
                    Esta acción no se puede deshacer y borrará también sus imágenes registradas.
                  </p>
                </div>

                <div className="delete-modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setUsuarioAEliminar(null)}
                    disabled={eliminando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-confirm-delete"
                    onClick={ejecutarEliminar}
                    disabled={eliminando}
                  >
                    {eliminando ? (
                      <>
                        <span className="spinner" style={{ width: 14, height: 14 }}></span>
                        <span>Eliminando...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
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
        </section>
      </main>
    </div>
  );
}
