import { NextRequest, NextResponse } from "next/server";
import { procesarExcelUsuarios } from "@/lib/procesadorExcel";
import { getSessionFromRequest } from "@/lib/auth";

export const maxDuration = 120; // 2 minutos para archivos grandes
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!session.esAdmin && session.role !== "administrador") {
      return NextResponse.json(
        { error: "Acceso denegado. Se requieren permisos de administrador para importar archivos Excel." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const esDryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo Excel (.xlsx o .xls)." },
        { status: 400 }
      );
    }

    // Límite de tamaño máximo (50 MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo permitido (50 MB)." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const resultado = await procesarExcelUsuarios({
      buffer,
      esDryRun,
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("Error al procesar el archivo Excel:", error);
    return NextResponse.json(
      {
        exito: false,
        error: error.message || "Error al procesar el archivo Excel.",
      },
      { status: 500 }
    );
  }
}
