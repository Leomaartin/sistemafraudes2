"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../css/sidebar.css";

interface NavOption {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
}

const OPCIONES_MENU: NavOption[] = [
  {
    label: "Gestión de Usuarios",
    href: "/usuarios",
    description: "Listado, filtros y edición de suministros",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Mapa Operativo",
    href: "/admin",
    description: "Visualización geoespacial y planificador",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    label: "Estadísticas del Sistema",
    href: "/estadisticas",
    description: "Estados, tarifas y asignación de cuadrillas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    label: "Informe General",
    href: "/informe-general",
    description: "Resumen de fraudes y zonas afectadas",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

interface AuthUser {
  email: string;
  name: string;
  picture?: string;
}

export default function SidebarLateral() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();

  // Ocultar sidebar completamente si está en la página de login
  const isLoginPage = pathname === "/login" || pathname === "/Login";

  // Cargar información de la sesión
  useEffect(() => {
    if (isLoginPage) return;
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, [isLoginPage]);

  // Cerrar el sidebar con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Cerrar el sidebar cuando cambia la ruta
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return null;
  }

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <>
      {/* Botón flotante de 3 rayas arriba a la izquierda */}
      <button
        type="button"
        id="btn-sidebar-hamburger"
        className={`btn-hamburger-toggle ${isOpen ? "is-active" : ""}`}
        onClick={toggleSidebar}
        aria-label={isOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
        title={isOpen ? "Cerrar menú lateral (Esc)" : "Abrir menú lateral"}
      >
        <span className="hamburger-bar"></span>
        <span className="hamburger-bar"></span>
        <span className="hamburger-bar"></span>
      </button>

      {/* Backdrop oscuro con desenfoque */}
      <div
        className={`sidebar-backdrop ${isOpen ? "is-visible" : ""}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Cajón lateral negro (Sidebar Drawer) */}
      <aside
        className={`sidebar-drawer ${isOpen ? "is-open" : ""}`}
        aria-label="Navegación principal"
      >
        {/* Cabecera del Sidebar */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">SISTEMA FRAUDES</span>
              <span className="sidebar-brand-subtitle">Operaciones Zárate</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-sidebar-close"
            onClick={closeSidebar}
            aria-label="Cerrar menú"
            title="Cerrar menú"
          >
            ✕
          </button>
        </div>

        {/* Lista de navegación de 4 módulos */}
        <div className="sidebar-body">
          <div className="sidebar-section-title">Módulos del Sistema</div>
          <ul className="sidebar-nav-list">
            {OPCIONES_MENU.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`sidebar-nav-link ${isActive ? "is-active" : ""}`}
                    onClick={closeSidebar}
                  >
                    <div className="nav-link-left">
                      <span className="nav-link-icon">{item.icon}</span>
                      <div className="nav-link-text-block">
                        <span className="nav-link-title">{item.label}</span>
                        <span className="nav-link-subtext">{item.description}</span>
                      </div>
                    </div>
                    {isActive && <span className="nav-link-indicator"></span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Pie del Sidebar con usuario y logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="sidebar-user-avatar">
              {user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt={user.name || "Usuario"}
                  className="sidebar-user-avatar-img"
                />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name" title={user?.name || "Administrador"}>
                {user?.name || "Administración"}
              </span>
              <span className="sidebar-user-email" title={user?.email || ""}>
                {user?.email || "En línea"}
              </span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-logout-btn"
            title="Cerrar sesión en el sistema"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Salir
          </button>
        </div>
      </aside>
    </>
  );
}
