import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const id = Number(body.id);
    const completado = Boolean(body.completado);

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 });
    }

    // Si es cuadrilla (no admin), verificar que el usuario pertenezca a su cuadrilla
    const isCuadrilla = session.role === "cuadrilla" && !session.esAdmin;
    if (isCuadrilla) {
      if (!session.cuadrillaId) {
        return NextResponse.json({ error: "Cuadrilla no configurada" }, { status: 403 });
      }
      const asignado = await prisma.usuario.findFirst({
        where: {
          id,
          cuadrillas: { some: { id: session.cuadrillaId } },
        },
      });
      if (!asignado) {
        return NextResponse.json(
          { error: "No puedes modificar usuarios que no están asignados a tu cuadrilla" },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { completado },
      select: { id: true, nroUsuario: true, completado: true },
    });

    return NextResponse.json({ success: true, usuario: updated });
  } catch (error) {
    console.error("Error al actualizar estado completado:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}
