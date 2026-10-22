import { NextRequest, NextResponse } from "next/server";
import { signSessionToken, SESSION_COOKIE_NAME, getAuthRedirectUri, getAppOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appOrigin = getAppOrigin(req);
  const loginUrl = new URL("/login", appOrigin);

  if (error) {
    loginUrl.searchParams.set("error", error);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    loginUrl.searchParams.set("error", "no_code");
    return NextResponse.redirect(loginUrl);
  }

  // Verificar state contra la cookie temporal para evitar ataques CSRF
  const savedState = req.cookies.get("cez_oauth_state")?.value;
  if (!state || !savedState || state !== savedState) {
    loginUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(loginUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    loginUrl.searchParams.set("error", "missing_credentials");
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = getAuthRedirectUri(req);

  try {
    // 1. Intercambiar code por token de acceso
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("Error intercambiando código OAuth de Google:", errBody);
      loginUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(loginUrl);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Obtener la información del perfil del usuario
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      console.error("Error obteniendo datos de usuario desde Google");
      loginUrl.searchParams.set("error", "userinfo_failed");
      return NextResponse.redirect(loginUrl);
    }

    const userInfo = await userInfoResponse.json();
    const userEmail = userInfo.email ? String(userInfo.email).toLowerCase().trim() : "";

    if (!userEmail) {
      console.warn("[AUTH] Acceso denegado: Google no proporcionó una dirección de correo.");
      loginUrl.searchParams.set("error", "no_email");
      return NextResponse.redirect(loginUrl);
    }

    // 3. Validación de seguridad DIRECTA CONTRA LA BASE DE DATOS (UsuarioSistema):
    // Tienen acceso los usuarios registrados en la BD con ese Gmail que estén activos (administradores o cuadrillas)
    const usuarioDb = await prisma.usuarioSistema.findFirst({
      where: {
        email: { equals: userEmail, mode: "insensitive" },
        activo: true,
      },
      include: {
        cuadrilla: true,
      },
    });

    if (!usuarioDb) {
      console.warn(
        `[AUTH] Acceso denegado: El correo ${userEmail} no está registrado en la base de datos como usuario habilitado.`
      );
      loginUrl.searchParams.set("error", "unauthorized");
      loginUrl.searchParams.set("email", userEmail);

      const deniedResponse = NextResponse.redirect(loginUrl);
      deniedResponse.cookies.delete(SESSION_COOKIE_NAME);
      deniedResponse.cookies.delete("cez_oauth_state");
      deniedResponse.cookies.delete("cez_redirect_to");
      return deniedResponse;
    }

    // 4. Usuario validado exitosamente en la BD: Generar JWT de sesión firmado
    const sessionToken = await signSessionToken({
      id: usuarioDb.id,
      email: usuarioDb.email || userEmail,
      name: usuarioDb.nombre || userInfo.name || userEmail.split("@")[0],
      picture: userInfo.picture,
      sub: userInfo.sub,
      role: usuarioDb.rol,
      esAdmin: usuarioDb.esAdmin,
      cuadrillaId: usuarioDb.idCuadrilla,
      cuadrillaNombre: usuarioDb.cuadrilla?.nombre || null,
    });

    // 5. Redirigir a la URL de origen o al panel principal
    const savedRedirect = req.cookies.get("cez_redirect_to")?.value;
    const targetPath = savedRedirect && savedRedirect.startsWith("/") ? savedRedirect : "/usuarios";
    const destinationUrl = new URL(targetPath, appOrigin);
    const successResponse = NextResponse.redirect(destinationUrl);

    successResponse.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 días de sesión
    });

    // Eliminar cookies temporales
    successResponse.cookies.delete("cez_oauth_state");
    successResponse.cookies.delete("cez_redirect_to");

    return successResponse;
  } catch (err: any) {
    console.error("Error procesando callback de Google:", err);
    loginUrl.searchParams.set("error", "internal_error");
    return NextResponse.redirect(loginUrl);
  }
}
