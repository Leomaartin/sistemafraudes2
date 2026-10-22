import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado. Inicie sesión en el sistema." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const ruta = searchParams.get("ruta");
    const search = searchParams.get("search");
    const soloGeo = searchParams.get("soloGeo") === "true";

    const where: any = {};

    // Si el usuario es de cuadrilla, filtrar usuarios que tiene asignados o en sus listados
    const isCuadrilla = session.role === "cuadrilla" && !session.esAdmin;
    let cuadrillaFilter: any = null;
    if (isCuadrilla) {
      if (!session.cuadrillaId) {
        return NextResponse.json([]);
      }
      cuadrillaFilter = {
        OR: [
          { cuadrillas: { some: { id: session.cuadrillaId } } },
          { listadoItems: { some: { listado: { idCuadrilla: session.cuadrillaId } } } },
        ],
      };
    }

    if (ruta) {
      const numRuta = parseInt(ruta, 10);
      const normalizada = isNaN(numRuta) ? ruta.trim() : String(numRuta);
      where.ruta = {
        in: [normalizada, ruta.trim(), normalizada.padStart(2, "0"), normalizada.padStart(3, "0")],
      };
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      const searchFilter = {
        OR: [
          { nroUsuario: { contains: term, mode: "insensitive" } },
          { nombre: { contains: term, mode: "insensitive" } },
          { domicilio: { contains: term, mode: "insensitive" } },
          { medidor: { contains: term, mode: "insensitive" } },
        ],
      };
      if (cuadrillaFilter) {
        where.AND = [cuadrillaFilter, searchFilter];
      } else {
        where.OR = searchFilter.OR;
      }
    } else if (cuadrillaFilter) {
      where.OR = cuadrillaFilter.OR;
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
