import { prisma } from "../lib/prisma";

async function verify() {
  const conteo = await prisma.usuario.groupBy({
    by: ["idEstado"],
    _count: { id: true },
  });
  const estados = await prisma.estado.findMany();
  const map = new Map(estados.map((e) => [e.id, e.nombre]));

  const total = conteo.reduce((acc, c) => acc + c._count.id, 0);

  const resultado = conteo
    .map((c) => ({
      idEstado: c.idEstado,
      nombre: c.idEstado ? map.get(c.idEstado) || "Desconocido" : "(SIN ASIGNAR)",
      cantidad: c._count.id,
      porcentaje: ((c._count.id / total) * 100).toFixed(2) + "%",
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  console.log(`\n=== ESTADO GENERAL ACTUALIZADO DEL PADRÓN (${total} usuarios) ===`);
  console.table(resultado);

  await prisma.$disconnect();
}

verify();
