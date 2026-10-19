import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const isCuadrilla = session.role === "cuadrilla" && !session.esAdmin;

    // Si es cuadrilla, solo sus listados asignados
    const where: any = {};
    if (isCuadrilla) {
      if (!session.cuadrillaId) {
        return NextResponse.json([]);
      }
      where.idCuadrilla = session.cuadrillaId;
    }

    const listados = await prisma.listadoCuadrilla.findMany({
      where,
      orderBy: { id: "desc" },
      include: {
        cuadrilla: true,
        items: {
          orderBy: { orden: "asc" },
          include: {
            usuario: {
              select: {
                id: true,
                nroUsuario: true,
                nombre: true,
                domicilio: true,
                medidor: true,
                ruta: true,
                completado: true,
              },
            },
          },
        },
      },
    });

    // Calcular estadísticas de progreso para cada listado
    const listadosConStats = listados.map((l) => {
      const total = l.items.length;
      const completados = l.items.filter((i) => i.completado).length;
      const pendientes = total - completados;
      const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

      return {
        ...l,
        stats: {
          total,
          completados,
          pendientes,
          porcentaje,
        },
      };
    });

    return NextResponse.json(listadosConStats);
  } catch (error) {
    console.error("Error al obtener listados:", error);
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo los administradores pueden crear y enviar listados
    const esAdmin = !!session.esAdmin || session.role === "administrador";
    if (!esAdmin) {
      return NextResponse.json(
        { error: "Solo los administradores pueden armar y enviar listados." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const titulo = String(body.titulo || "").trim();
    const idCuadrilla = Number(body.idCuadrilla);
    const descripcion = body.descripcion ? String(body.descripcion).trim() : null;
    const todosLosUsuarios = Boolean(body.todosLosUsuarios);
    const filtroRuta = body.filtroRuta ? String(body.filtroRuta).trim() : null;

    if (!titulo) {
      return NextResponse.json(
        { error: "El título del listado es obligatorio." },
        { status: 400 }
      );
    }

    if (!idCuadrilla || isNaN(idCuadrilla)) {
      return NextResponse.json(
        { error: "Debe seleccionar una cuadrilla de destino." },
        { status: 400 }
      );
    }

    const defaultTitulo = body.defaultTitulo ? String(body.defaultTitulo).trim() : null;
    const titulosMap: Record<number, string> = body.titulos || {};

    // Determinar qué usuarios incluir y sus títulos individuales
    let itemsInput: Array<{ idUsuario: number; titulo: string | null }> = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      itemsInput = body.items
        .map((it: any) => {
          const uid = Number(it.idUsuario ?? it.id);
          const t = it.titulo !== undefined ? String(it.titulo).trim() : (titulosMap[uid] || defaultTitulo || null);
          return {
            idUsuario: uid,
            titulo: t || null,
          };
        })
        .filter((it: any) => !isNaN(it.idUsuario));
    } else if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      itemsInput = body.userIds
        .map((rawId: any) => {
          const uid = Number(rawId);
          const t = titulosMap[uid] !== undefined ? String(titulosMap[uid]).trim() : (defaultTitulo || null);
          return {
            idUsuario: uid,
            titulo: t || null,
          };
        })
        .filter((it: any) => !isNaN(it.idUsuario));
    } else if (filtroRuta) {
      const users = await prisma.usuario.findMany({
        where: { ruta: filtroRuta },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      itemsInput = users.map((u) => {
        const t = titulosMap[u.id] !== undefined ? String(titulosMap[u.id]).trim() : (defaultTitulo || null);
        return {
          idUsuario: u.id,
          titulo: t || null,
        };
      });
    }

    const finalUserIds = itemsInput.map((it) => it.idUsuario);

    if (finalUserIds.length === 0) {
      return NextResponse.json(
        { error: "Debe seleccionar al menos un usuario para armar el listado." },
        { status: 400 }
      );
    }

    // 1. Crear la cabecera del listado
    const listadoCreado = await prisma.listadoCuadrilla.create({
      data: {
        titulo,
        descripcion,
        idCuadrilla,
      },
      include: {
        cuadrilla: true,
      },
    });

    // 2. Insertar todos los items del listado en bloques optimizados de 2,000 registros
    const itemsData = itemsInput.map((it, index) => ({
      idListado: listadoCreado.id,
      idUsuario: it.idUsuario,
      titulo: it.titulo,
      orden: index + 1,
      completado: false,
    }));

    const CHUNK_SIZE = 2000;
    for (let i = 0; i < itemsData.length; i += CHUNK_SIZE) {
      const chunk = itemsData.slice(i, i + CHUNK_SIZE);
      await prisma.listadoItem.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    // 3. Vincular automáticamente la cuadrilla a los usuarios asignados (en la tabla _CuadrillaToUsuario)
    if (todosLosUsuarios && !filtroRuta) {
      // Si son todos los usuarios del sistema, vincular con una sola consulta SQL directa
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_CuadrillaToUsuario" ("A", "B")
        SELECT ${idCuadrilla}, "id" FROM "Usuario"
        ON CONFLICT DO NOTHING;
      `);
    } else {
      // Si es un subconjunto o ruta, vincular en bloques
      for (let i = 0; i < finalUserIds.length; i += CHUNK_SIZE) {
        const chunk = finalUserIds.slice(i, i + CHUNK_SIZE);
        const idsList = chunk.join(",");
        if (idsList.length > 0) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "_CuadrillaToUsuario" ("A", "B")
            SELECT ${idCuadrilla}, "id" FROM "Usuario" WHERE "id" IN (${idsList})
            ON CONFLICT DO NOTHING;
          `);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Listado "${titulo}" creado con ${finalUserIds.length} usuarios y enviado exitosamente a la cuadrilla.`,
      listadoId: listadoCreado.id,
      totalUsuarios: finalUserIds.length,
    });
  } catch (error: any) {
    console.error("Error al crear listado:", error);
    return NextResponse.json(
      { error: error?.message || "Error al crear el listado en el servidor." },
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

    const esAdmin = !!session.esAdmin || session.role === "administrador";
    if (!esAdmin) {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID de listado inválido" }, { status: 400 });
    }

    await prisma.listadoCuadrilla.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Listado eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar listado:", error);
    return NextResponse.json({ error: "Error al eliminar el listado." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const id = Number(body.idListado || body.id);

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "ID de listado requerido." }, { status: 400 });
    }

    const listado = await prisma.listadoCuadrilla.findUnique({
      where: { id },
      include: { cuadrilla: true },
    });

    if (!listado) {
      return NextResponse.json({ error: "Listado no encontrado." }, { status: 404 });
    }

    const esAdmin = !!session.esAdmin || session.role === "administrador";
    const esCuadrillaAsignada =
      session.role === "cuadrilla" && session.cuadrillaId === listado.idCuadrilla;

    if (!esAdmin && !esCuadrillaAsignada) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar este listado." },
        { status: 403 }
      );
    }

    const updateData: any = {};

    // 1. Marcar como completada por la cuadrilla (o admin)
    if (body.completado !== undefined) {
      const isComp = Boolean(body.completado);
      updateData.completado = isComp;
      updateData.fechaCompletado = isComp ? new Date() : null;

      // Si se solicita completar todos los items automáticamente
      if (isComp && body.marcarTodosItems) {
        await prisma.listadoItem.updateMany({
          where: { idListado: id },
          data: { completado: true, fechaCompletado: new Date() },
        });
      }
    }

    // 2. Dar por terminado / Archivar (exclusivo admin)
    if (body.terminado !== undefined) {
      if (!esAdmin) {
        return NextResponse.json(
          { error: "Solo los administradores pueden dar por terminado o archivar un listado." },
          { status: 403 }
        );
      }
      const isTerm = Boolean(body.terminado);
      updateData.terminado = isTerm;
      updateData.fechaTerminado = isTerm ? new Date() : null;
    }

    const updated = await prisma.listadoCuadrilla.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Listado actualizado correctamente.",
      listado: updated,
    });
  } catch (error: any) {
    console.error("Error al actualizar listado:", error);
    return NextResponse.json(
      { error: error?.message || "Error al actualizar el listado." },
      { status: 500 }
    );
  }
}

