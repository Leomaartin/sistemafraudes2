import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const totalUsuarios = await prisma.usuario.count();

    // Obtener conteo por ruta
    const rutasRaw = await prisma.usuario.groupBy({
      by: ["ruta"],
      _count: {
        id: true,
      },
      orderBy: {
        ruta: "asc",
      },
    });

    const rutas = rutasRaw
      .filter((r) => r.ruta !== null && r.ruta.trim() !== "")
      .map((r) => ({
        ruta: r.ruta as string,
        cantidad: r._count.id,
      }))
      .sort((a, b) => {
        const numA = parseInt(a.ruta, 10);
        const numB = parseInt(b.ruta, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.ruta.localeCompare(b.ruta);
      });

    return NextResponse.json({
      totalUsuarios,
      rutas,
    });
  } catch (error) {
    console.error("Error al obtener rutas y conteos:", error);
    return NextResponse.json(
      { error: "Error en el servidor al cargar rutas." },
      { status: 500 }
    );
  }
}
