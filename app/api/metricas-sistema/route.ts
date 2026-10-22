import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenerConfigEstadoPorUsuario } from "@/lib/estadoColors";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Usuarios totales y métricas base
    const totalUsuarios = await prisma.usuario.count();
    const conGeoTotal = await prisma.usuario.count({
      where: { latitud: { not: null }, longitud: { not: null } },
    });
    const sinGeoTotal = totalUsuarios - conGeoTotal;

    // 2. Traer todos los estados con conteo y métricas (excluyendo estados exclusivos de acceso de departamento)
    const estadosDb = await prisma.estado.findMany({
      where: {
        id: { notIn: [18, 19, 20, 21] },
      },
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
      orderBy: {
        usuarios: { _count: "desc" },
      },
    });

    // 3. Desglose detallado por Estado (fraudes, geolocalizados, deptos)
    const usuariosPorEstado = await prisma.usuario.groupBy({
      by: ["idEstado"],
      _count: {
        id: true,
      },
      where: {
        idEstado: { not: null },
      },
    });

    const usuariosConGeoPorEstado = await prisma.usuario.groupBy({
      by: ["idEstado"],
      _count: {
        id: true,
      },
      where: {
        idEstado: { not: null },
        latitud: { not: null },
        longitud: { not: null },
      },
    });

    const mapConGeoEstado = new Map<number, number>();
    usuariosConGeoPorEstado.forEach((g) => {
      if (g.idEstado !== null) mapConGeoEstado.set(g.idEstado, g._count.id);
    });

    // Conteo de usuarios en departamento por cada Estado
    const usuariosDeptoPorEstado = await prisma.usuario.groupBy({
      by: ["idEstado"],
      _count: {
        id: true,
      },
      where: {
        idEstado: { not: null },
        esDepartamento: true,
      },
    });

    const mapDeptosEstado = new Map<number, number>();
    usuariosDeptoPorEstado.forEach((d) => {
      if (d.idEstado !== null) mapDeptosEstado.set(d.idEstado, d._count.id);
    });

    let totalFraudesGlobal = 0;

    const listaEstados = estadosDb.map((est) => {
      const total = est._count.usuarios;
      const totalDeptos = mapDeptosEstado.get(est.id) || 0;
      const conGeo = mapConGeoEstado.get(est.id) || 0;
      const sinGeo = total - conGeo;
      const porcentajeDelTotal = totalUsuarios > 0 ? (total / totalUsuarios) * 100 : 0;

      const esFraude = /FRAUDE/i.test(est.nombre);
      if (esFraude) {
        totalFraudesGlobal += total;
      }

      const colorInfo = obtenerConfigEstadoPorUsuario({ id: est.id, nombre: est.nombre });

      return {
        id: est.id,
        nombre: est.nombre.toUpperCase(),
        totalUsuarios: total,
        totalDeptos,
        conGeo,
        sinGeo,
        porcentajeDelTotal: Number(porcentajeDelTotal.toFixed(2)),
        esFraude,
        colorInfo: {
          bg: colorInfo.bg,
          text: colorInfo.text,
          border: colorInfo.border,
          badgeBg: colorInfo.badgeBg,
          badgeText: colorInfo.badgeText,
          colorName: colorInfo.colorName,
          emoji: colorInfo.emoji,
        },
      };
    });

    // Usuarios sin estado asignado
    const usuariosSinEstado = await prisma.usuario.count({
      where: { idEstado: null },
    });
    const deptosSinEstado = await prisma.usuario.count({
      where: { idEstado: null, esDepartamento: true },
    });
    const totalDeptosGlobal = await prisma.usuario.count({
      where: { esDepartamento: true },
    });

    if (usuariosSinEstado > 0) {
      listaEstados.push({
        id: 0,
        nombre: "(SIN ESTADO ASIGNADO)",
        totalUsuarios: usuariosSinEstado,
        totalDeptos: deptosSinEstado,
        conGeo: 0,
        sinGeo: usuariosSinEstado,
        porcentajeDelTotal: Number(((usuariosSinEstado / totalUsuarios) * 100).toFixed(2)),
        esFraude: false,
        colorInfo: {
          bg: "#94a3b8",
          text: "#1e293b",
          border: "#cbd5e1",
          badgeBg: "#f1f5f9",
          badgeText: "#475569",
          colorName: "gris",
          emoji: undefined,
        },
      });
    }

    // 4. Métricas de Tarifas
    const tarifasDb = await prisma.tarifa.findMany({
      include: {
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
      orderBy: {
        usuarios: { _count: "desc" },
      },
    });

    // Fraudes por tarifa
    const fraudesPorTarifa = await prisma.usuario.groupBy({
      by: ["idTarifa"],
      _count: {
        id: true,
      },
      where: {
        idTarifa: { not: null },
        estado: {
          nombre: { contains: "FRAUDE", mode: "insensitive" },
        },
      },
    });

    const mapFraudesTarifa = new Map<number, number>();
    fraudesPorTarifa.forEach((f) => {
      if (f.idTarifa !== null) mapFraudesTarifa.set(f.idTarifa, f._count.id);
    });

    // Geo por tarifa
    const geoPorTarifa = await prisma.usuario.groupBy({
      by: ["idTarifa"],
      _count: {
        id: true,
      },
      where: {
        idTarifa: { not: null },
        latitud: { not: null },
        longitud: { not: null },
      },
    });
    const mapGeoTarifa = new Map<number, number>();
    geoPorTarifa.forEach((g) => {
      if (g.idTarifa !== null) mapGeoTarifa.set(g.idTarifa, g._count.id);
    });

    const listaTarifas = tarifasDb.map((tar) => {
      const total = tar._count.usuarios;
      const fraudes = mapFraudesTarifa.get(tar.id) || 0;
      const conGeo = mapGeoTarifa.get(tar.id) || 0;
      const sinGeo = total - conGeo;
      const tasaFraude = total > 0 ? (fraudes / total) * 100 : 0;
      const porcentajeDelTotal = totalUsuarios > 0 ? (total / totalUsuarios) * 100 : 0;

      let nivelRiesgo: "Alto" | "Medio" | "Bajo" = "Bajo";
      if (tasaFraude >= 40) nivelRiesgo = "Alto";
      else if (tasaFraude >= 15) nivelRiesgo = "Medio";

      return {
        id: tar.id,
        nombre: tar.nombre.trim(),
        totalUsuarios: total,
        totalFraudes: fraudes,
        tasaFraude: Number(tasaFraude.toFixed(2)),
        porcentajeDelTotal: Number(porcentajeDelTotal.toFixed(2)),
        conGeo,
        sinGeo,
        nivelRiesgo,
      };
    });

    // 5. Métricas de Cuadrillas
    const cuadrillasDb = await prisma.cuadrilla.findMany({
      include: {
        usuarios: {
          select: {
            id: true,
            latitud: true,
            longitud: true,
            estado: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        _count: {
          select: {
            usuarios: true,
          },
        },
      },
      orderBy: {
        usuarios: { _count: "desc" },
      },
    });

    const totalUsuariosEnCuadrillas = await prisma.usuario.count({
      where: {
        cuadrillas: { some: {} },
      },
    });
    const totalUsuariosSinCuadrilla = totalUsuarios - totalUsuariosEnCuadrillas;

    const listaCuadrillas = cuadrillasDb.map((c) => {
      const total = c._count.usuarios;
      let fraudes = 0;
      let conGeo = 0;
      const estadosCount: Record<string, number> = {};

      c.usuarios.forEach((u) => {
        if (u.latitud !== null && u.longitud !== null) conGeo++;
        const estNombre = u.estado?.nombre || "SIN ESTADO";
        estadosCount[estNombre] = (estadosCount[estNombre] || 0) + 1;
        if (/FRAUDE/i.test(estNombre)) fraudes++;
      });

      const sinGeo = total - conGeo;
      const tasaFraude = total > 0 ? (fraudes / total) * 100 : 0;
      const porcentajeDelTotal = totalUsuarios > 0 ? (total / totalUsuarios) * 100 : 0;

      return {
        id: c.id,
        nombre: c.nombre.trim(),
        totalUsuarios: total,
        totalFraudes: fraudes,
        tasaFraude: Number(tasaFraude.toFixed(2)),
        porcentajeDelTotal: Number(porcentajeDelTotal.toFixed(2)),
        conGeo,
        sinGeo,
        desgloseEstados: estadosCount,
      };
    });

    return NextResponse.json({
      globales: {
        totalUsuarios,
        totalFraudes: totalFraudesGlobal,
        tasaFraudeGlobal: totalUsuarios > 0 ? Number(((totalFraudesGlobal / totalUsuarios) * 100).toFixed(2)) : 0,
        conGeo: conGeoTotal,
        sinGeo: sinGeoTotal,
        porcentajeGeo: totalUsuarios > 0 ? Number(((conGeoTotal / totalUsuarios) * 100).toFixed(2)) : 0,
        totalDeptos: totalDeptosGlobal,
        totalEstados: listaEstados.length,
        totalTarifas: listaTarifas.length,
        totalCuadrillas: listaCuadrillas.length,
        usuariosEnCuadrillas: totalUsuariosEnCuadrillas,
        usuariosSinCuadrilla: totalUsuariosSinCuadrilla,
        porcentajeAsignadoCuadrillas: totalUsuarios > 0 ? Number(((totalUsuariosEnCuadrillas / totalUsuarios) * 100).toFixed(2)) : 0,
      },
      estados: listaEstados,
      tarifas: listaTarifas,
      cuadrillas: listaCuadrillas,
      actualizadoEl: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error obteniendo métricas del sistema:", error);
    return NextResponse.json(
      { error: "Error al calcular métricas del sistema" },
      { status: 500 }
    );
  }
}
