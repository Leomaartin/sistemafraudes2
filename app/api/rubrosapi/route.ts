import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rubros = await prisma.rubro.findMany({
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(rubros);
  } catch (error: unknown) {
    console.error("Error al obtener rubros:", error);
    return NextResponse.json(
      { error: "Error al obtener los rubros" },
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
        { error: "El nombre del rubro es obligatorio" },
        { status: 400 }
      );
    }

    const nuevoRubro = await prisma.rubro.create({
      data: { nombre },
    });

    return NextResponse.json(nuevoRubro, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear rubro:", error);
    return NextResponse.json(
      { error: "Error al crear el rubro" },
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

    const rubroActualizado = await prisma.rubro.update({
      where: { id },
      data: { nombre },
    });

    return NextResponse.json(rubroActualizado);
  } catch (error: unknown) {
    console.error("Error al actualizar rubro:", error);
    return NextResponse.json(
      { error: "Error al actualizar el rubro" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { error: "ID de rubro inválido" },
        { status: 400 }
      );
    }

    await prisma.rubro.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Rubro eliminado correctamente" });
  } catch (error: unknown) {
    console.error("Error al eliminar rubro:", error);
    return NextResponse.json(
      { error: "No se puede eliminar el rubro porque puede tener usuarios asociados" },
      { status: 500 }
    );
  }
}
