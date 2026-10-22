import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { TARIFAS_OFICIALES, TARIFAS_OFICIALES_SET, encontrarTarifaMasSimilar } from "@/lib/tarifasConfig";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const tarifas = await prisma.tarifa.findMany({
      where: {
        nombre: { in: [...TARIFAS_OFICIALES] },
      },
      orderBy: { nombre: "asc" },
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
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!session.esAdmin && session.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const rawNombre = String(body.nombre || "").trim();

    if (!rawNombre) {
      return NextResponse.json(
        { error: "El nombre de la tarifa es obligatorio" },
        { status: 400 }
      );
    }

    const nombreOficial = TARIFAS_OFICIALES_SET.has(rawNombre)
      ? rawNombre
      : encontrarTarifaMasSimilar(rawNombre);

    if (!nombreOficial) {
      return NextResponse.json(
        { error: `Tarifa no permitida. Solo se admiten las tarifas oficiales autorizadas.` },
        { status: 400 }
      );
    }

    // Verificar si ya existe
    const existente = await prisma.tarifa.findFirst({
      where: { nombre: nombreOficial },
    });
    if (existente) {
      return NextResponse.json(existente, { status: 200 });
    }

    const nuevaTarifa = await prisma.tarifa.create({
      data: { nombre: nombreOficial },
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
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!session.esAdmin && session.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador." },
        { status: 403 }
      );
    }

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
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!session.esAdmin && session.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador." },
        { status: 403 }
      );
    }

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