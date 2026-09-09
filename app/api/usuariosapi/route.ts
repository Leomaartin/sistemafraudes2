import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        cuadrillas: true,
        tarifa: true,
        estado: true,
        imagenes: true,
      },
    });
    return NextResponse.json(usuarios);
  } catch (error) {
    console.error("Error:", error);

    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  }
}
