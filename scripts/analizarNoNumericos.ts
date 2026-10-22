import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.usuario.findMany({
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
    },
  });

  const noNumericos = new Map<string, typeof users>();

  for (const u of users) {
    const raw = u.nroUsuario?.trim().toLowerCase() || "";
    // Es no numérico o vacío o placeholder si no consiste de dígitos
    if (!/^\d+$/.test(raw)) {
      if (!noNumericos.has(raw)) {
        noNumericos.set(raw, []);
      }
      noNumericos.get(raw)!.push(u);
    }
  }

  console.log(`Valores no numéricos de nroUsuario encontrados (${noNumericos.size} distintos):`);
  for (const [val, list] of noNumericos.entries()) {
    console.log(`- "${val}": ${list.length} registros`);
    if (list.length > 1) {
      console.log(`   Ejemplos: ${list.slice(0, 3).map((u) => `#${u.id} (${u.nombre} - ${u.domicilio})`).join(" | ")}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
