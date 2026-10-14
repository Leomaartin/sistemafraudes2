import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile, stat } from "fs/promises";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params;
    const filename = slug.join("/");

    // Evitar navegación maliciosa fuera del directorio
    if (filename.includes("..") || filename.startsWith("/")) {
      return new NextResponse("Acceso no permitido", { status: 403 });
    }

    const filePath = path.join(process.cwd(), "public", "img", filename);

    await stat(filePath);
    const fileBuffer = await readFile(filePath);

    const ext = path.extname(filename).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".svg") contentType = "image/svg+xml";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Imagen no encontrada", { status: 404 });
  }
}
