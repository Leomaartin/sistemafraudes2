import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const usuarioId = req.nextUrl.searchParams.get("usuarioId");

    if (!usuarioId) {
      return NextResponse.json(
        { error: "Falta usuarioId" },
        { status: 400 }
      );
    }

    const images = await prisma.imagen.findMany({
      where: {
        usuarioId: Number(usuarioId),
      },
    });

    // Sanitizar y normalizar URLs para que en producción siempre sean relativas (/img/...)
    const normalizedImages = images.map((img) => {
      let cleanUrl = img.url || "";
      if (
        cleanUrl.includes("localhost") ||
        cleanUrl.includes("127.0.0.1") ||
        cleanUrl.startsWith("http://") ||
        cleanUrl.startsWith("https://")
      ) {
        const match = cleanUrl.match(/\/img\/.+$/);
        if (match) cleanUrl = match[0];
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
    const formData = await req.formData();

    const archivo = formData.get("archivo") as File;
    const usuarioId = formData.get("usuarioId");

    if (!usuarioId || !archivo) {
      return NextResponse.json(
        { error: "usuarioId y archivo son obligatorios" },
        { status: 400 }
      );
    }
    if (!(archivo instanceof File)) {
      return NextResponse.json(
        { error: "El archivo no es válido" },
        { status: 400 }
      );
    }
    const extension = path.extname(archivo.name) || ".jpg";
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
        usuarioId: Number(usuarioId),
      },
    });

    return NextResponse.json(imagen, { status: 201 });
  } catch (error) {
    console.error("Error al agregar imagen:", error);
    return NextResponse.json(
      { error: "Error al agregar la imagen" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const usuarioId = req.nextUrl.searchParams.get("usuarioId");
    const imagenId = req.nextUrl.searchParams.get("imagenId");

    if (!usuarioId || !imagenId) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    const imagen = await prisma.imagen.delete({
      where: {
        id: Number(imagenId),
        usuarioId: Number(usuarioId),
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
