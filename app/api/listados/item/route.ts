import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const itemId = Number(body.itemId);
    const idListado = Number(body.idListado);
    const idUsuario = Number(body.idUsuario);
    const completado = Boolean(body.completado);

    // Buscar el item por itemId o por (idListado, idUsuario)
    let item = null;
    if (itemId && !isNaN(itemId)) {
      item = await prisma.listadoItem.findUnique({
        where: { id: itemId },
        include: { listado: true },
      });
    } else if (idListado && idUsuario && !isNaN(idListado) && !isNaN(idUsuario)) {
      item = await prisma.listadoItem.findUnique({
        where: {
          idListado_idUsuario: {
            idListado,
            idUsuario,
          },
        },
        include: { listado: true },
      });
    }

    if (!item) {
      return NextResponse.json(
        { error: "Item de listado no encontrado." },
        { status: 404 }
      );
    }

    // Verificar permisos: Administrador o la Cuadrilla asignada a este listado
    const esAdmin = !!session.esAdmin || session.role === "administrador";
    const esCuadrillaAsignada =
      session.role === "cuadrilla" && session.cuadrillaId === item.listado.idCuadrilla;

    if (!esAdmin && !esCuadrillaAsignada) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar este listado." },
        { status: 403 }
      );
    }

    const dataToUpdate: any = {};
    if (body.completado !== undefined) {
      dataToUpdate.completado = completado;
      dataToUpdate.fechaCompletado = completado ? new Date() : null;
    }
    if (body.titulo !== undefined) {
      dataToUpdate.titulo = body.titulo ? String(body.titulo).trim() : null;
    }

    // Actualizar el item del listado
    const updatedItem = await prisma.listadoItem.update({
      where: { id: item.id },
      data: dataToUpdate,
      include: {
        usuario: true,
      },
    });

    // Si se modificó completado, también actualizar en Usuario
    if (body.completado !== undefined) {
      await prisma.usuario.update({
        where: { id: item.idUsuario },
        data: { completado },
      });
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error: any) {
    console.error("Error al actualizar item de listado:", error);
    return NextResponse.json(
      { error: error?.message || "Error al actualizar el estado del item." },
      { status: 500 }
    );
  }
}
