import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
    try {
        const id = Number(req.nextUrl.searchParams.get("id"));
        if (!id || isNaN(id)) {
            return NextResponse.json(
                { error: "El ID del usuario es obligatorio y debe ser numérico" },
                { status: 400 }
            );
        }
        const usuario = await prisma.usuario.delete({
            where: { id },
            include: {
                cuadrilla: true,
                estado: true,
                tarifa: true,
            }
        });
        return NextResponse.json(usuario);
    } catch (error: unknown) {
        console.error("Error al eliminar usuario:", error);
        const err = error as { code?: string };
        if (err?.code === "P2025") {
            return NextResponse.json(
                { error: "No se encontró el usuario a eliminar." },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "Error al eliminar el usuario en el servidor" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: Number(req.nextUrl.searchParams.get("id")) },
            include: {
                cuadrilla: true,
                estado: true,
                tarifa: true,
            }
        });
        return NextResponse.json(usuario);
    } catch (error: unknown) {
        console.error("Error al obtener usuario:", error);
        return NextResponse.json(
            { error: "Error al obtener el usuario en el servidor" },
            { status: 500 }
        );
    }
}



export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const parseId = (val: unknown): number | null => {
            if (val === undefined || val === null || val === "") return null;
            const num = Number(val);
            return isNaN(num) ? null : num;
        };

        const idCuadrilla = parseId(body.idCuadrilla ?? body.cuadrillaId ?? body.cuadrilla);
        const idEstado = parseId(body.idEstado ?? body.estadoId ?? body.estado);
        const idTarifa = parseId(body.idTarifa ?? body.tarifaId ?? body.tarifa);

        const usuario = await prisma.usuario.create({
            data: {
                nroUsuario: String(body.nroUsuario || "").trim(),
                nombre: String(body.nombre || "").trim(),
                domicilio: body.domicilio ? String(body.domicilio).trim() : null,
                ruta: body.ruta ? String(body.ruta).trim() : null,
                observaciones: body.observaciones ? String(body.observaciones).trim() : null,
                maps: body.maps ? String(body.maps).trim() : null,
                idCuadrilla,
                idEstado,
                idTarifa,
            },
            include: {
                cuadrilla: true,
                estado: true,
                tarifa: true,
            }
        });

        return NextResponse.json(usuario, { status: 201 });
    } catch (error: unknown) {
        console.error("Error al crear usuario:", error);
        const err = error as { code?: string };
        if (err?.code === "P2002") {
            return NextResponse.json(
                { error: "Ya existe un usuario con ese número de usuario." },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: "Error al crear el usuario en el servidor" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();

        const idParam = body.id ?? req.nextUrl.searchParams.get("id");
        const id = Number(idParam);

        if (!id || isNaN(id)) {
            return NextResponse.json(
                { error: "El ID del usuario es obligatorio y debe ser numérico" },
                { status: 400 }
            );
        }

        if (body.nroUsuario !== undefined && !String(body.nroUsuario).trim()) {
            return NextResponse.json(
                { error: "El número de usuario no puede estar vacío" },
                { status: 400 }
            );
        }

        if (body.nombre !== undefined && !String(body.nombre).trim()) {
            return NextResponse.json(
                { error: "El nombre no puede estar vacío" },
                { status: 400 }
            );
        }

        const parseOptionalId = (val: unknown): number | null | undefined => {
            if (val === undefined) return undefined;
            if (val === null || val === "") return null;
            const num = Number(val);
            return isNaN(num) ? null : num;
        };

        const hasCuadrillaKey = "idCuadrilla" in body || "cuadrillaId" in body || "cuadrilla" in body;
        const hasEstadoKey = "idEstado" in body || "estadoId" in body || "estado" in body;
        const hasTarifaKey = "idTarifa" in body || "tarifaId" in body || "tarifa" in body;

        const idCuadrilla = hasCuadrillaKey
            ? parseOptionalId(body.idCuadrilla ?? body.cuadrillaId ?? body.cuadrilla)
            : undefined;

        const idEstado = hasEstadoKey
            ? parseOptionalId(body.idEstado ?? body.estadoId ?? body.estado)
            : undefined;

        const idTarifa = hasTarifaKey
            ? parseOptionalId(body.idTarifa ?? body.tarifaId ?? body.tarifa)
            : undefined;

        const usuario = await prisma.usuario.update({
            where: { id },
            data: {
                nroUsuario: body.nroUsuario !== undefined ? String(body.nroUsuario).trim() : undefined,
                nombre: body.nombre !== undefined ? String(body.nombre).trim() : undefined,
                domicilio: body.domicilio !== undefined ? (body.domicilio ? String(body.domicilio).trim() : null) : undefined,
                ruta: body.ruta !== undefined ? (body.ruta ? String(body.ruta).trim() : null) : undefined,
                observaciones: body.observaciones !== undefined ? (body.observaciones ? String(body.observaciones).trim() : null) : undefined,
                maps: body.maps !== undefined ? (body.maps ? String(body.maps).trim() : null) : undefined,
                idCuadrilla,
                idEstado,
                idTarifa,
            },
            include: {
                cuadrilla: true,
                estado: true,
                tarifa: true,
            }
        });

        return NextResponse.json(usuario);
    } catch (error: unknown) {
        console.error("Error al actualizar usuario:", error);
        const err = error as { code?: string };
        if (err?.code === "P2002") {
            return NextResponse.json(
                { error: "Ya existe un usuario con ese número de usuario." },
                { status: 409 }
            );
        }
        if (err?.code === "P2025") {
            return NextResponse.json(
                { error: "No se encontró el usuario a actualizar." },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "Error al actualizar el usuario en el servidor" },
            { status: 500 }
        );
    }
}