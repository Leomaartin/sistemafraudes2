import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.usuario.findMany({
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      latitud: true,
      longitud: true,
      medidor: true,
      observaciones: true,
      _count: {
        select: {
          imagenes: true,
          listadoItems: true,
          cuadrillas: true,
        },
      },
    },
  });

  const mapNro = new Map<string, typeof users>();

  for (const u of users) {
    const nro = u.nroUsuario?.trim();
    if (!nro) continue;
    if (!mapNro.has(nro)) {
      mapNro.set(nro, []);
    }
    mapNro.get(nro)!.push(u);
  }

  const duplicados: { nro: string; count: number; users: typeof users }[] = [];

  for (const [nro, list] of mapNro.entries()) {
    if (list.length > 1) {
      duplicados.push({ nro, count: list.length, users: list });
    }
  }

  duplicados.sort((a, b) => b.count - a.count);

  const totalUsuariosDuplicados = duplicados.reduce((acc, d) => acc + d.count, 0);
  const totalRegistrosAEliminar = duplicados.reduce((acc, d) => acc + (d.count - 1), 0);

  console.log("=== ANÁLISIS DE USUARIOS DUPLICADOS POR NRO DE USUARIO ===");
  console.log(`Nros de usuario repetidos: ${duplicados.length}`);
  console.log(`Total registros involucrados: ${totalUsuariosDuplicados}`);
  console.log(`Total registros sobrantes a eliminar: ${totalRegistrosAEliminar}`);
  console.log("\nPrimeros 15 ejemplos de duplicados:");

  for (let i = 0; i < Math.min(15, duplicados.length); i++) {
    const d = duplicados[i];
    console.log(`\nNroUsuario: "${d.nro}" (${d.count} registros):`);
    for (const u of d.users) {
      console.log(`  - ID: ${u.id} | Nombre: "${u.nombre}" | Dom: "${u.domicilio}" | Medidor: "${u.medidor}" | Coords: ${u.latitud ? "SI" : "NO"} | Fotos: ${u._count.imagenes} | Listados: ${u._count.listadoItems} | Cuadrillas: ${u._count.cuadrillas}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
