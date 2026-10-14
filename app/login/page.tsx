"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import "../css/login.css";

function LoginContent() {
  const searchParams = useSearchParams();
  const rawError = searchParams.get("error");
  const rejectedEmail = searchParams.get("email");
  const errorMsg = searchParams.get("msg");
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  const error = dismissed ? null : rawError;

  const dismissError = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/login");
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    dismissError();
    // Redirigir al endpoint de autenticación con Google
    window.location.href = "/api/auth/google";
  };

  return (
    <div className="login-card">
      {/* Logo CEZ oficial */}
      <div className="login-logo-container">
        <div className="login-logo-ring"></div>
        <Image
          src="/img/logo.jpg"
          alt="Logo Cooperativa Eléctrica de Zárate"
          width={96}
          height={96}
          className="login-logo-img"
          priority
        />
      </div>

      {/* Identidad institucional */}
      <div className="login-brand-tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        COOPERATIVA ELÉCTRICA DE ZÁRATE
      </div>

      <h1 className="login-title">Sistema de Fraudes</h1>
      <p className="login-subtitle">
        Portal de gestión operativa y control de suministros. Acceso restringido exclusivamente a personal autorizado.
      </p>

      {/* Mensajes de error según el parámetro de URL */}
      {error === "unauthorized" && (
        <div className="login-alert login-alert-danger" role="alert">
          <div className="login-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="login-alert-content">
            <span className="login-alert-title">Acceso Denegado</span>
            El correo {rejectedEmail ? <span className="login-email-badge">{rejectedEmail}</span> : "ingresado"} no se encuentra registrado en la base de datos como administrador autorizado. Inicie sesión con una cuenta de Google habilitada en el sistema.
          </div>
          <button type="button" onClick={dismissError} className="login-alert-close" aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      {error === "missing_credentials" && (
        <div className="login-alert login-alert-warning" role="alert">
          <div className="login-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="login-alert-content">
            <span className="login-alert-title">Aviso de configuración</span>
            Si acabas de agregar las credenciales en <code>.env</code>, haz clic directamente en <strong>Continuar con Google</strong>.
          </div>
          <button type="button" onClick={dismissError} className="login-alert-close" aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      {error && error !== "unauthorized" && error !== "missing_credentials" && (
        <div className="login-alert login-alert-danger" role="alert">
          <div className="login-alert-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="login-alert-content">
            <span className="login-alert-title">Error de autenticación</span>
            {error === "internal_error" ? (
              <>
                <span>Ocurrió un error interno en el servidor al autenticar.</span>
                {errorMsg && (
                  <div style={{ marginTop: "4px", fontSize: "11px", opacity: 0.9, wordBreak: "break-all" }}>
                    <strong>Detalle:</strong> {decodeURIComponent(errorMsg)}
                  </div>
                )}
              </>
            ) : (
              `Ocurrió un problema al validar la sesión (${error}). Por favor, intente nuevamente.`
            )}
          </div>
          <button type="button" onClick={dismissError} className="login-alert-close" aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      {/* Botón de Google Login */}
      <button
        type="button"
        id="btn-google-login"
        className="btn-google-login"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Conectando con Google...
          </>
        ) : (
          <>
            <svg className="google-icon-svg" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar con Google</span>
          </>
        )}
      </button>

      {/* Pie de seguridad */}
      <div className="login-card-footer">
        <div className="login-secure-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Autenticación segura Google OAuth 2.0
        </div>
        <span>CEZ • Zárate, Buenos Aires</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="login-wrapper">
      <div className="login-glow-bg" />
      <div className="login-glow-bottom" />
      <Suspense fallback={<div className="text-white">Cargando acceso...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
