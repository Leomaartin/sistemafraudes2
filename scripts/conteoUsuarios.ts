import { prisma } from "../lib/prisma";

async function main() {
  const total = await prisma.usuario.count();
  const conCoords = await prisma.usuario.count({
    where: {
      latitud: { not: null },
      longitud: { not: null }
    }
  });
  const sinCoords = await prisma.usuario.count({
    where: {
      OR: [
        { latitud: null },
        { longitud: null }
      ]
    }
  });

  console.log(JSON.stringify({ total, conCoords, sinCoords }));
}

main().finally(() => prisma.$disconnect());
