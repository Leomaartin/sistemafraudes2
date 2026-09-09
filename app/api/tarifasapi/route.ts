import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tarifas = await prisma.tarifa.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(tarifas);
  } catch (error: unknown) {
    console.error("Error al obtener tarifas:", error);
    return NextResponse.json(
      { error: "Error al obtener las tarifas" },
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
        { error: "El nombre de la tarifa es obligatorio" },
        { status: 400 }
      );
    }

    const nuevaTarifa = await prisma.tarifa.create({
      data: { nombre },
    });

    return NextResponse.json(nuevaTarifa, { status: 201 });
  } catch (error: unknown) {
    console.error("Error al crear tarifa:", error);
    return NextResponse.json(
      { error: "Error al crear la tarifa" },
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

    const tarifaActualizada = await prisma.tarifa.update({
      where: { id },
      data: { nombre },
    });

    return NextResponse.json(tarifaActualizada);
  } catch (error: unknown) {
    console.error("Error al actualizar tarifa:", error);
    return NextResponse.json(
      { error: "Error al actualizar la tarifa" },
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
        { error: "El ID de la tarifa es obligatorio" },
        { status: 400 }
      );
    }

    const usuariosAsociados = await prisma.usuario.count({
      where: { idTarifa: id },
    });

    if (usuariosAsociados > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: hay ${usuariosAsociados} usuario(s) asignado(s) a esta tarifa. Reasígnalos antes de eliminar.`,
        },
        { status: 409 }
      );
    }

    await prisma.tarifa.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Tarifa eliminada correctamente" });
  } catch (error: unknown) {
    console.error("Error al eliminar tarifa:", error);
    return NextResponse.json(
      { error: "Error al eliminar la tarifa" },
      { status: 500 }
    );
  }
}