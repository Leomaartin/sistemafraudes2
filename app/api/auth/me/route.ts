import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session || !session.email) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Validar en la BD que el usuario siga existiendo y esté activo (administrador o cuadrilla)
  const usuarioDb = await prisma.usuarioSistema.findFirst({
    where: {
      email: { equals: session.email, mode: "insensitive" },
      activo: true,
    },
    include: {
      cuadrilla: true,
    },
  });

  if (!usuarioDb) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: usuarioDb.email || session.email,
      name: usuarioDb.nombre || session.name,
      picture: session.picture,
      role: usuarioDb.rol,
      esAdmin: usuarioDb.esAdmin,
      cuadrillaId: usuarioDb.idCuadrilla,
      cuadrillaNombre: usuarioDb.cuadrilla?.nombre || null,
    },
  });
}
