import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cuadrillas = await prisma.cuadrilla.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(cuadrillas);
  } catch (error: unknown) {
    console.error("Error al obtener cuadrillas:", error);
    return NextResponse.json(
      { error: "Error al obtener las cuadrillas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const nombre = String(body.nombre || "").trim();

    if (!nombre) {
      return NextResponse.json(
        { error: "El nombre de la cuadrilla es obligatorio" },
        { status: 400 }
      );
    }

    const nuevaCuadrilla = await prisma.cuadrilla.create({
      data: { nombre },
    });

    return NextResponse.json(nuevaCuadrilla, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear cuadrilla:", error);
    return NextResponse.json(
      { error: "Error al crear la cuadrilla" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    const nombre = String(body.nombre || "").trim();

    if (!id || !nombre) {
      return NextResponse.json(
        { error: "ID y nombre son obligatorios" },
        { status: 400 }
      );
    }

    const cuadrillaActualizada = await prisma.cuadrilla.update({
      where: { id },
      data: { nombre },
    });

    return NextResponse.json(cuadrillaActualizada);
  } catch (error: unknown) {
    console.error("Error al actualizar cuadrilla:", error);
    return NextResponse.json(
      { error: "Error al actualizar la cuadrilla" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const id = idParam ? Number(idParam) : null;

    if (!id) {
      return NextResponse.json(
        { error: "El ID de la cuadrilla es obligatorio" },
        { status: 400 }
      );
    }

    // Verificar si hay usuarios asociados
    const usuariosAsociados = await prisma.usuario.count({
      where: { idCuadrilla: id },
    });

    if (usuariosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: hay ${usuariosAsociados} usuario(s) asignado(s) a esta cuadrilla. Reasígnalos antes de eliminar.`,
        },
        { status: 409 }
      );
    }

    await prisma.cuadrilla.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Cuadrilla eliminada correctamente" });
  } catch (error: unknown) {
    console.error("Error al eliminar cuadrilla:", error);
    return NextResponse.json(
      { error: "Error al eliminar la cuadrilla" },
      { status: 500 }
    );
  }
}