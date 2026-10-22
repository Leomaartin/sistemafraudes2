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

  // Normalizar nroUsuario: quitar puntos y comas de miles (ej: "99,743" o "166.863" -> "99743")
  function limpiarNro(raw: string): string {
    const s = raw.trim().replace(/[.,]/g, "");
    return s;
  }

  const mapNumericos = new Map<string, typeof users>();

  for (const u of users) {
    const raw = u.nroUsuario?.trim() || "";
    const limpio = limpiarNro(raw);

    // Si es estrictamente numérico
    if (/^\d+$/.test(limpio)) {
      if (!mapNumericos.has(limpio)) {
        mapNumericos.set(limpio, []);
      }
      mapNumericos.get(limpio)!.push(u);
    }
  }

  let dupCount = 0;
  let totalInvolucrados = 0;
  let aEliminar = 0;

  for (const [nro, list] of mapNumericos.entries()) {
    if (list.length > 1) {
      dupCount++;
      totalInvolucrados += list.length;
      aEliminar += (list.length - 1);
    }
  }

  console.log(`=== DUPLICADOS REALES CON NÚMERO DE CUENTA NUMÉRICO ===`);
  console.log(`Cuentas con duplicados: ${dupCount}`);
  console.log(`Total registros involucrados: ${totalInvolucrados}`);
  console.log(`Registros a eliminar (sobrantes): ${aEliminar}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
