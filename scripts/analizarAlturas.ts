import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.usuario.findMany({
    where: { latitud: { not: null } },
    select: { id: true, domicilio: true, latitud: true, longitud: true }
  });
  console.log("Total usuarios geolocalizados:", users.length);
  const coordGroups: Record<string, string[]> = {};
  for (const u of users) {
    if (u.latitud === null || u.longitud === null) continue;
    const key = u.latitud.toFixed(5) + "," + u.longitud.toFixed(5);
    if (!coordGroups[key]) coordGroups[key] = [];
    coordGroups[key].push(u.domicilio || "sin domicilio");
  }
  const duplicates = Object.entries(coordGroups)
    .filter(([_, list]) => list.length > 5)
    .sort((a, b) => b[1].length - a[1].length);

  console.log("Grupos con más de 5 usuarios en exactamente las mismas coordenadas:", duplicates.length);
  duplicates.slice(0, 15).forEach(([coord, list]) => {
    console.log(`\n📍 ${coord} -> Total: ${list.length} usuarios`);
    console.log("Ejemplos:", list.slice(0, 8).join(" | "));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
