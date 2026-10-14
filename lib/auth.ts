import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export interface SessionUser {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  role?: string;
  esAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export const SESSION_COOKIE_NAME = "cez_session";
const DEFAULT_SECRET = "cez_sistema_fraudes_secret_token_default_key_2026";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

// Codificador base64url seguro para tokens JWT
function base64UrlEncode(data: Uint8Array | string): string {
  const binary = typeof data === "string" 
    ? new TextEncoder().encode(data) 
    : data;
  
  let base64 = "";
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(binary).toString("base64");
  } else {
    base64 = btoa(String.fromCharCode(...binary));
  }
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

// Crear token JWT firmado con HMAC SHA-256 usando Web Crypto API (Edge & Node compatible)
export async function signSessionToken(payload: Omit<SessionUser, "iat" | "exp">, expiresInSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionUser = {
    ...payload,
    email: payload.email.toLowerCase().trim(),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const key = await crypto.subtle.importKey(
    "raw",
    getSecretKey() as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    dataToSign as unknown as BufferSource
  );
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Verificar token JWT firmado
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const dataToVerify = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signatureBytes = base64UrlDecode(encodedSignature);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      getSecretKey() as unknown as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      dataToVerify as unknown as BufferSource
    );

    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload: SessionUser = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Token expirado
    }

    return payload;
  } catch (err) {
    console.error("Error verificando token de sesión:", err);
    return null;
  }
}

// Las validaciones de acceso se realizan directamente contra la base de datos (UsuarioSistema)


// Obtener sesión activa desde request (compatible con middleware y endpoints)
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

// Obtener sesión activa en Server Components
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

/**
 * Obtiene el origen base de la aplicación (ej: https://sistemafraudes-fron.kttquy.easypanel.host)
 * Evita devolver 'localhost' o puertos internos de Docker (como localhost:80) cuando se ejecuta en producción.
 */
export function getAppOrigin(req: NextRequest): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  // 1. Si en el entorno de producción se definió la URL real (ej: https://midominio.com), usarla
  if (configuredUrl && !configuredUrl.includes("localhost")) {
    return configuredUrl.replace(/\/$/, "");
  }

  // 2. Si la petición viene a través de un dominio público (detectado por headers de proxy de EasyPanel, Vercel, etc.)
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || (req.nextUrl.protocol ? req.nextUrl.protocol.replace(":", "") : "https");

  if (forwardedHost && !forwardedHost.includes("localhost")) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. Entorno de desarrollo local (localhost)
  const localOrigin = configuredUrl?.replace(/\/$/, "") || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return localOrigin;
}

/**
 * Obtiene la URL de redirección exacta para Google OAuth.
 */
export function getAuthRedirectUri(req: NextRequest): string {
  const origin = getAppOrigin(req);
  return `${origin}/api/auth/callback/google`;
}

