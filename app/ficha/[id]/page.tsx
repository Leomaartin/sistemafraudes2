import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenerConfigEstadoPorUsuario } from "@/lib/estadoColors";
import { obtenerInfoVencimiento } from "@/lib/vencimiento";
import { getValidImageUrl } from "@/lib/imageUtils";
import { getSession } from "@/lib/auth";
import FichaCliente from "./FichaCliente";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Ficha Inspección #${id} | CEZ Zárate`,
    description: `Ficha de inspección, fotos y ubicación en Google Maps del usuario #${id} de CEZ Zárate.`,
  };
}

export default async function FichaUsuarioPage({ params }: PageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id).trim();

  // 1. Verificar autenticación con Google
  const session = await getSession();
  if (!session) {
    redirect(`/login?from=/ficha/${encodeURIComponent(decodedId)}`);
  }

  // Buscar por número de usuario o por ID numérico de base de datos
  const numId = parseInt(decodedId, 10);
  const whereOr: any[] = [{ nroUsuario: decodedId }];
  if (!isNaN(numId)) {
    whereOr.push({ id: numId });
  }

  const usuario = await prisma.usuario.findFirst({
    where: { OR: whereOr },
    include: {
      cuadrillas: true,
      listadoItems: {
        include: {
          listado: true,
        },
        orderBy: { id: "desc" },
      },
      estado: true,
      estadoDepto: true,
      tarifa: true,
      imagenes: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!usuario) {
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #34966a 0%, #3eb187 60%, #3caf85 100%)", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif" }}>
        <div style={{ maxWidth: "460px", width: "100%", background: "#ffffff", padding: "36px 28px", borderRadius: "18px", textAlign: "center", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 10px 35px rgba(0,0,0,0.22)" }}>
          <div style={{ width: "64px", height: "64px", margin: "0 auto 16px auto", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #cbd5e1" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>Usuario no encontrado</h1>
          <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.5", margin: "0 0 20px 0" }}>
            No se encontró ningún usuario con número o ID <strong>&quot;{decodedId}&quot;</strong> en el sistema de CEZ Zárate.
          </p>
          <a
            href="/usuarios"
            style={{ display: "inline-block", background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#ffffff", padding: "12px 24px", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "14px", boxShadow: "0 4px 12px rgba(15,23,42,0.2)" }}
          >
            ← Volver al listado
          </a>
        </div>
      </div>
    );
  }

  // 2. Control de acceso por Cuadrilla:
  // Permitir acceso si es administrador, si está en usuario.cuadrillas O si fue incluido en cualquier listado de su cuadrilla
  const esAdmin = !!session.esAdmin || session.role === "administrador";
  let itemAsignadoCuadrilla: any = null;

  if (!esAdmin && session.role === "cuadrilla") {
    const estaEnCuadrilla = usuario.cuadrillas.some((c) => c.id === session.cuadrillaId);
    itemAsignadoCuadrilla = usuario.listadoItems?.find(
      (item) => item.listado?.idCuadrilla === session.cuadrillaId
    );
    const estaEnListado = !!itemAsignadoCuadrilla;

    if (!estaEnCuadrilla && !estaEnListado) {
      return (
        <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 0%, #34966a 0%, #3eb187 60%, #3caf85 100%)", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif" }}>
          <div style={{ maxWidth: "460px", width: "100%", background: "#ffffff", padding: "36px 28px", borderRadius: "18px", textAlign: "center", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 10px 35px rgba(0,0,0,0.22)" }}>
            <div style={{ width: "64px", height: "64px", margin: "0 auto 16px auto", borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fecaca" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#991b1b", background: "#fee2e2", padding: "4px 12px", borderRadius: "999px", marginBottom: "12px" }}>
              Acceso Restringido
            </span>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
              Usuario no asignado a tu cuadrilla
            </h1>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              El suministro <strong>#{usuario.nroUsuario}</strong> ({usuario.nombre || "Sin nombre"}) no forma parte de la hoja de ruta de tu cuadrilla ni ha sido asignado en ningún listado activo.
            </p>
            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "12px", textAlign: "left", fontSize: "13px", color: "#334155", marginBottom: "20px", border: "1.5px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "#64748b" }}>Tu Cuadrilla:</span>
                <span style={{ fontWeight: 800, color: "#0b5c30" }}>{session.cuadrillaNombre || `ID ${session.cuadrillaId || "Sin asignar"}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Tu Cuenta:</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{session.email}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href="/usuarios"
                style={{ display: "block", background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#ffffff", padding: "13px 20px", borderRadius: "12px", textDecoration: "none", fontWeight: 800, fontSize: "14px", boxShadow: "0 4px 14px rgba(15,23,42,0.25)" }}
              >
                Ver mis usuarios y listados
              </a>
              <a
                href="/api/auth/logout"
                style={{ display: "block", background: "#f1f5f9", color: "#64748b", padding: "10px 20px", borderRadius: "12px", textDecoration: "none", fontWeight: 700, fontSize: "13px", border: "1px solid #cbd5e1" }}
              >
                Cambiar de cuenta / Cerrar sesión
              </a>
            </div>
          </div>
        </div>
      );
    }
  } else {
    itemAsignadoCuadrilla = usuario.listadoItems?.[0] || null;
  }

  const configEstado = obtenerConfigEstadoPorUsuario(usuario.estado);
  const vtoInfo = usuario.fechaVto ? obtenerInfoVencimiento(usuario.fechaVto) : null;

  // Procesar URLs válidas de imágenes
  const imagenesLimpias = (usuario.imagenes || []).map((img) => ({
    id: img.id,
    url: getValidImageUrl(img.url),
    usuarioId: img.usuarioId,
    createdAt: img.createdAt ? img.createdAt.toISOString() : null,
  }));

  const usuarioProps = {
    id: usuario.id,
    nroUsuario: usuario.nroUsuario,
    nombre: usuario.nombre,
    domicilio: usuario.domicilio,
    medidor: usuario.medidor,
    ruta: usuario.ruta,
    latitud: usuario.latitud,
    longitud: usuario.longitud,
    observaciones: usuario.observaciones,
    estado: usuario.estado ? { id: usuario.estado.id, nombre: usuario.estado.nombre } : null,
    estadoDepto: usuario.estadoDepto ? { id: usuario.estadoDepto.id, nombre: usuario.estadoDepto.nombre } : null,
    tarifa: usuario.tarifa ? { id: usuario.tarifa.id, nombre: usuario.tarifa.nombre } : null,
    esDepartamento: usuario.esDepartamento,
    fechaVtoFormatted: vtoInfo ? vtoInfo.fechaFormateada : undefined,
    tituloTarea: itemAsignadoCuadrilla?.titulo || null,
    listadoTitulo: itemAsignadoCuadrilla?.listado?.titulo || null,
    completado: itemAsignadoCuadrilla ? itemAsignadoCuadrilla.completado : usuario.completado,
    idListadoItem: itemAsignadoCuadrilla?.id || null,
    idListado: itemAsignadoCuadrilla?.idListado || null,
  };

  return (
    <FichaCliente
      usuario={usuarioProps}
      configEstado={configEstado}
      imagenes={imagenesLimpias}
    />
  );
}
