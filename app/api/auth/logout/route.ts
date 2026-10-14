import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true, message: "Sesión cerrada" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
