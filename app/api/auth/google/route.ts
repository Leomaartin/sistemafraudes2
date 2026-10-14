import { NextRequest, NextResponse } from "next/server";
import { getAuthRedirectUri, getAppOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appOrigin = getAppOrigin(req);
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || clientId.trim() === "") {
    console.error("[AUTH] Error: GOOGLE_CLIENT_ID no configurada en .env");
    return NextResponse.redirect(
      new URL("/login?error=missing_credentials", appOrigin)
    );
  }

  // Determinar la URL base de redirección precisa para Google OAuth
  const redirectUri = getAuthRedirectUri(req);

  // Generar un state criptográfico aleatorio para protección CSRF
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const state = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: state,
    prompt: "select_account", // Permite elegir cuenta en cada login
    access_type: "online",
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log("[AUTH] Redirigiendo a Google OAuth:", googleAuthUrl);

  const response = NextResponse.redirect(googleAuthUrl);

  // Guardar el state en una cookie temporal para verificar en el callback
  response.cookies.set("cez_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutos
  });

  return response;
}
