import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function verificarAccesoUsuario(session: any, usuarioId: number): Promise<boolean> {
  if (session.esAdmin || session.role === "administrador") {
    return true;
  }
  if (session.role === "cuadrilla" && session.cuadrillaId) {
    const asignado = await prisma.usuario.findFirst({
      where: {
        id: usuarioId,
        OR: [
          { cuadrillas: { some: { id: session.cuadrillaId } } },
          { listadoItems: { some: { listado: { idCuadrilla: session.cuadrillaId } } } },
        ],
      },
    });
    return !!asignado;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuarioId = req.nextUrl.searchParams.get("usuarioId");
    if (!usuarioId || isNaN(Number(usuarioId))) {
      return NextResponse.json(
        { error: "usuarioId inválido o faltante" },
        { status: 400 }
      );
    }

    const numUsuarioId = Number(usuarioId);
    const tienePermiso = await verificarAccesoUsuario(session, numUsuarioId);
    if (!tienePermiso) {
      return NextResponse.json(
        { error: "Acceso denegado a las imágenes de este usuario" },
        { status: 403 }
      );
    }

    const images = await prisma.imagen.findMany({
      where: {
        usuarioId: numUsuarioId,
      },
    });

    // Sanitizar y normalizar URLs para que siempre sean relativas (/img/...)
    const normalizedImages = images.map((img) => {
      let cleanUrl = (img.url || "").trim().replace(/\\/g, "/");
      const match = cleanUrl.match(/\/img\/.+$/i);
      if (match) {
        cleanUrl = match[0];
      } else if (cleanUrl.toLowerCase().startsWith("img/")) {
        cleanUrl = `/${cleanUrl}`;
      } else if (cleanUrl.toLowerCase().startsWith("public/img/")) {
        cleanUrl = cleanUrl.replace(/^public/i, "");
      } else if (!cleanUrl.includes("/") && !cleanUrl.startsWith("http") && cleanUrl.length > 0) {
        cleanUrl = `/img/${cleanUrl}`;
      }
      return {
        ...img,
        url: cleanUrl,
      };
    });

    return NextResponse.json(normalizedImages);
  } catch (error) {
    console.error("Error al obtener imágenes:", error);
    return NextResponse.json(
      { error: "Error al obtener las imágenes" },
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

    const formData = await req.formData();
    const archivo = formData.get("archivo") as File;
    const usuarioIdParam = formData.get("usuarioId");

    if (!usuarioIdParam || !archivo) {
      return NextResponse.json(
        { error: "usuarioId y archivo son obligatorios" },
        { status: 400 }
      );
    }

    const numUsuarioId = Number(usuarioIdParam);
    if (isNaN(numUsuarioId)) {
      return NextResponse.json(
        { error: "usuarioId debe ser numérico" },
        { status: 400 }
      );
    }

    const tienePermiso = await verificarAccesoUsuario(session, numUsuarioId);
    if (!tienePermiso) {
      return NextResponse.json(
        { error: "Acceso denegado para adjuntar fotos a este usuario" },
        { status: 403 }
      );
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "El archivo proporcionado no es válido" },
        { status: 400 }
      );
    }

    // 1. Validar tamaño máximo
    if (archivo.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "La imagen excede el límite máximo permitido de 10 MB" },
        { status: 400 }
      );
    }

    // 2. Validar extensión permitida estrictamente
    const extension = path.extname(archivo.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Formato no permitido. Solo se admiten archivos JPG, PNG y WEBP." },
        { status: 400 }
      );
    }

    // 3. Validar MIME type
    if (archivo.type && !ALLOWED_MIME_TYPES.has(archivo.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Tipo de contenido inválido. Debe ser una imagen válida." },
        { status: 400 }
      );
    }

    const nombreArchivo = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const dirImg = path.join(process.cwd(), "public", "img");
    await mkdir(dirImg, { recursive: true });

    const rutaArchivo = path.join(dirImg, nombreArchivo);
    const bytes = await archivo.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(rutaArchivo, buffer);

    const imagen = await prisma.imagen.create({
      data: {
        url: `/img/${nombreArchivo}`,
        usuarioId: numUsuarioId,
      },
    });

    return NextResponse.json(imagen, { status: 201 });
  } catch (error) {
    console.error("Error al agregar imagen:", error);
    return NextResponse.json(
      { error: "Error al guardar la imagen en el servidor" },
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

    const usuarioId = req.nextUrl.searchParams.get("usuarioId");
    const imagenId = req.nextUrl.searchParams.get("imagenId");

    if (!usuarioId || !imagenId || isNaN(Number(usuarioId)) || isNaN(Number(imagenId))) {
      return NextResponse.json(
        { error: "Parámetros usuarioId e imagenId requeridos y numéricos" },
        { status: 400 }
      );
    }

    const numUsuarioId = Number(usuarioId);
    const numImagenId = Number(imagenId);

    const tienePermiso = await verificarAccesoUsuario(session, numUsuarioId);
    if (!tienePermiso) {
      return NextResponse.json(
        { error: "Acceso denegado para eliminar imágenes de este usuario" },
        { status: 403 }
      );
    }

    const imagen = await prisma.imagen.delete({
      where: {
        id: numImagenId,
        usuarioId: numUsuarioId,
      },
    });

    return NextResponse.json(imagen);
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    return NextResponse.json(
      { error: "Error al eliminar la imagen" },
      { status: 500 }
    );
  }
}
