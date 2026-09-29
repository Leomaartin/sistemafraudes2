import { prisma } from "../lib/prisma";
import fs from "fs";

async function main() {
  const totalUsuarios = await prisma.usuario.count();
  
  // 1. Estados de todo el padrón
  const conteoGlobal = await prisma.usuario.groupBy({
    by: ["idEstado"],
    _count: { id: true },
  });
  const catalogoEstados = await prisma.estado.findMany();
  const estadoMap = new Map(catalogoEstados.map((e) => [e.id, e.nombre]));

  const reporteGlobal = conteoGlobal
    .map((c) => ({
      idEstado: c.idEstado,
      nombre: c.idEstado ? estadoMap.get(c.idEstado) || "Desconocido" : "(SIN ESTADO ASIGNADO)",
      cantidad: c._count.id,
      porcentaje: ((c._count.id / totalUsuarios) * 100).toFixed(2),
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // 2. Análisis detallado de los usuarios que QUEDAN sin estado asignado
  const sinEstado = await prisma.usuario.findMany({
    where: { idEstado: null },
    select: { id: true, nroUsuario: true, nombre: true, domicilio: true, observaciones: true },
  });

  const totalSinEstado = sinEstado.length;

  // Analizar sus observaciones
  let sinObs = 0;
  const categoriasRestantes: Record<string, { count: number; samples: string[] }> = {};

  function clasificarRestante(raw: string | null): string {
    if (!raw || !raw.trim()) {
      sinObs++;
      return "SIN OBSERVACIONES / CAMPO VACÍO";
    }
    const o = raw.toUpperCase();
    if (/CAMBIO\s+DE\s+MEDIDOR|MEDIDOR\s+NUEVO|MEDIDOR\s+DE\s+ALTA/i.test(o)) return "CAMBIO DE MEDIDOR / ALTA TÉCNICA";
    if (/MEDIDOR\s+INTERNO|INTERNO/i.test(o)) return "MEDIDOR INTERNO / ACCESO DIFICULTOSO";
    if (/MEDIDOR\s+ROTO|MEDIDOR\s+CON\s+AGUA|ROTURA/i.test(o)) return "MEDIDOR DEFECTUOSO / CON AGUA / ROTO";
    if (/LLAVES?\s+INMOBILIARIA|INMOBILIARIA/i.test(o)) return "REFERENCIA INMOBILIARIA / LLAVES";
    if (/CARNICERIA|MERCADO|LOCAL|COMERCIO/i.test(o)) return "REFERENCIA COMERCIAL / LOCAL";
    if (/NO\s+EXISTE|VIVIENDA|DEMOLID/i.test(o)) return "VIVIENDA INEXISTENTE / DEMOLIDA";
    if (/NO\s+ENCONTRARON|NO\s+ENCUENTRAN/i.test(o)) return "SUMINISTRO / MEDIDOR NO LOCALIZADO";
    if (/REVISAR|VERIFICAR|ENVIAR\s+FOTO/i.test(o)) return "SOLICITUD DE RE-INSPECCIÓN / FOTO";
    if (/SIN\s+SERVICIO|NO\s+TIENE\s+CABLES/i.test(o)) return "SIN SERVICIO TÉCNICO / SIN CABLES";
    if (/PAGO\s+(?:A\s+CUENTA|PARCIAL)|DEUDA/i.test(o)) return "TRÁMITE DE PAGO O DEUDA";
    if (/M\s*-\s*\d+|ESTADO\s+\d+/i.test(o)) return "SOLO LECTURA DE MEDIDOR / ESTADO NUMÉRICO";
    return "OTRAS NOTAS TÉCNICAS DIVERSAS";
  }

  for (const u of sinEstado) {
    const cat = clasificarRestante(u.observaciones);
    if (!categoriasRestantes[cat]) {
      categoriasRestantes[cat] = { count: 0, samples: [] };
    }
    categoriasRestantes[cat].count++;
    if (categoriasRestantes[cat].samples.length < 4 && u.observaciones?.trim()) {
      categoriasRestantes[cat].samples.push(u.observaciones.trim());
    }
  }

  const sortedRestantes = Object.entries(categoriasRestantes).sort((a, b) => b[1].count - a[1].count);

  const resultadoCompleto = {
    totalUsuarios,
    reporteGlobal,
    totalSinEstado,
    sortedRestantes,
  };

  fs.writeFileSync("scripts/nuevo_informe_estados.json", JSON.stringify(resultadoCompleto, null, 2), "utf-8");
  console.log("JSON guardado en scripts/nuevo_informe_estados.json");

  await prisma.$disconnect();
}

main().catch(console.error);
