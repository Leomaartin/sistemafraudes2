import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, getAppOrigin } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const appOrigin = getAppOrigin(req);

  // 1. Permitir archivos estáticos y recursos internos de Next.js
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/img") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Permitir rutas públicas de autenticación
  const isAuthApi = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login" || pathname === "/Login";

  // 3. Verificar si existe cookie de sesión válida firmada
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;
  if (token) {
    session = await verifySessionToken(token);
    // La sesión es válida si el token JWT está firmado y cuenta con rol de administrador
    if (session && !session.esAdmin && session.role !== "administrador") {
      session = null;
    }
  }

  const isAuthenticated = !!session;

  // Si el usuario ya está autenticado e intenta ir a /login, redirigir al panel
  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/usuarios", appOrigin));
    }
    return NextResponse.next();
  }

  // Permitir endpoints de autenticación (/api/auth/*)
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Para TODAS las demás páginas y APIs del sistema: requerir autenticación
  if (!isAuthenticated) {
    // Si es una petición de API interna, responder 401
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "No autorizado. Inicie sesión en el sistema CEZ." },
        { status: 401 }
      );
    }

    // Si es una navegación a página, redirigir al Login
    const loginUrl = new URL("/login", appOrigin);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configuración de rutas que el middleware debe interceptar
export const config = {
  matcher: [
    /*
     * Interceptar todo excepto:
     * - api/auth (manejado arriba)
     * - _next/static, _next/image
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
