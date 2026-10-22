import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, getAppOrigin } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const appOrigin = getAppOrigin(req);

  // Bloquear de inmediato intentos de acceder a archivos confidenciales
  if (pathname.includes("/.") || pathname.endsWith(".env") || pathname.includes(".git")) {
    return new NextResponse("Acceso denegado", { status: 403 });
  }

  // 1. Permitir archivos estáticos reales y recursos internos de Next.js
  const isStaticFile = /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff|woff2|ttf|eot|map|txt|webmanifest)$/i.test(pathname);
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/img") ||
    pathname.startsWith("/favicon.ico") ||
    isStaticFile
  ) {
    return NextResponse.next();
  }

  // 2. Permitir rutas públicas de autenticación (/api/auth/...)
  const isAuthApi = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login" || pathname === "/Login";

  // 3. Verificar si existe cookie de sesión válida firmada
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;
  if (token) {
    session = await verifySessionToken(token);
    // Verificar si el rol es válido (administrador o cuadrilla autorizada)
    const isAutorizado =
      session &&
      (session.esAdmin || session.role === "administrador" || session.role === "cuadrilla");

    if (!isAutorizado) {
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

  // Permitir endpoints de autenticación (/api/auth/...)
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Para TODAS las demás páginas y APIs del sistema (incluida la ficha /ficha): requerir autenticación
  if (!isAuthenticated) {
    // Si es una petición de API interna, responder 401
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "No autorizado. Inicie sesión en el sistema CEZ." },
        { status: 401 }
      );
    }

    // Si es una navegación a página, redirigir al Login preservando la URL de destino
    const loginUrl = new URL("/login", appOrigin);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 4. Si el usuario está autenticado pero tiene rol "cuadrilla", restringir acceso a secciones de administración
  const isCuadrilla = session?.role === "cuadrilla" && !session?.esAdmin;
  if (isCuadrilla) {
    const isAdminPage =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/armar-listado") ||
      pathname.startsWith("/estadisticas") ||
      pathname.startsWith("/informe-general");

    if (isAdminPage) {
      return NextResponse.redirect(new URL("/usuarios", appOrigin));
    }

    // Restringir llamadas a APIs exclusivas de administración
    const isAdminApi =
      pathname.startsWith("/api/importar-excel") ||
      (pathname.startsWith("/api/cuadrillasapi") && req.method !== "GET") ||
      (pathname.startsWith("/api/estadosapi") && req.method !== "GET") ||
      (pathname.startsWith("/api/tarifasapi") && req.method !== "GET") ||
      (pathname.startsWith("/api/rubrosapi") && req.method !== "GET");

    if (isAdminApi) {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador." },
        { status: 403 }
      );
    }
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
