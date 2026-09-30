import { NextRequest, NextResponse } from "next/server";
import { procesarExcelUsuarios } from "@/lib/procesadorExcel";

export const maxDuration = 120; // 2 minutos para archivos grandes
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const esDryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo Excel (.xlsx o .xls)." },
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
