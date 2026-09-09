import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const estados = await prisma.estado.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(estados);
  } catch (error: unknown) {
    console.error("Error al obtener estados:", error);
    return NextResponse.json(
      { error: "Error al obtener los estados" },
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
        { error: "El nombre del estado es obligatorio" },
        { status: 400 }
      );
    }

    const nuevoEstado = await prisma.estado.create({
      data: { nombre },
    });

    return NextResponse.json(nuevoEstado, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear estado:", error);
    return NextResponse.json(
      { error: "Error al crear el estado" },
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

    const estadoActualizado = await prisma.estado.update({
      where: { id },
      data: { nombre },
    });

    return NextResponse.json(estadoActualizado);
  } catch (error: unknown) {
    console.error("Error al actualizar estado:", error);
    return NextResponse.json(
      { error: "Error al actualizar el estado" },
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
        { error: "El ID del estado es obligatorio" },
        { status: 400 }
      );
    }

    const usuariosAsociados = await prisma.usuario.count({
      where: { idEstado: id },
    });

    if (usuariosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: hay ${usuariosAsociados} usuario(s) asignado(s) a este estado. Reasígnalos antes de eliminar.`,
        },
        { status: 409 }
      );
    }

    await prisma.estado.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Estado eliminado correctamente" });
  } catch (error: unknown) {
    console.error("Error al eliminar estado:", error);
    return NextResponse.json(
      { error: "Error al eliminar el estado" },
      { status: 500 }
    );
  }
}