import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ruta = searchParams.get("ruta");
    const search = searchParams.get("search");
    const soloGeo = searchParams.get("soloGeo") === "true";

    const where: any = {};

    if (ruta) {
      const numRuta = parseInt(ruta, 10);
      const normalizada = isNaN(numRuta) ? ruta.trim() : String(numRuta);
      where.ruta = {
        in: [normalizada, ruta.trim(), normalizada.padStart(2, "0"), normalizada.padStart(3, "0")],
      };
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { nroUsuario: { contains: term, mode: "insensitive" } },
        { nombre: { contains: term, mode: "insensitive" } },
        { domicilio: { contains: term, mode: "insensitive" } },
        { medidor: { contains: term, mode: "insensitive" } },
      ];
    }

    if (soloGeo) {
      where.latitud = { not: null };
      where.longitud = { not: null };
    }

    const usuarios = await prisma.usuario.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      take: search ? 50 : undefined,
      orderBy: { id: "asc" },
      include: {
        cuadrillas: true,
        tarifa: true,
        estado: true,
        estadoDepto: true,
        rubro: true,
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
