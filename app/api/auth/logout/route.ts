import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getAppOrigin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appOrigin = getAppOrigin(req);
  const loginUrl = new URL("/login", appOrigin);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true, message: "Sesión cerrada" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
