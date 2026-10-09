import { prisma } from "../lib/prisma";

export const TARIFAS_OFICIALES = [
  "T1RN1",
  "T1R-N2",
  "1G-I",
  "G1-N1",
  "G1-N2",
  "G1-N3",
  "IO",
  "RN1",
  "n2",
  "T1G",
  "T1G-D",
  "T1G-EBP",
  "T1G-G",
  "T1G-I",
  "T1R",
  "T1R-G1",
  "T1R-G1-N1",
  "T1R-G1-N2",
  "T1R-G1-N3",
  "T1R-G2-N2",
  "T1R-I",
  "T1R-N1",
  "T1RN-3",
  "T1R-N3",
  "T1R-P",
  "T4NR",
  "TASO",
  "TI1R",
  "TSED",
  "TS-G1-C1",
];

// Función para encontrar la tarifa oficial más similar a cualquier valor dado
export function encontrarTarifaMasSimilar(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === "-") return null;

  // Coincidencia exacta insensible a mayúsculas/minúsculas
  for (const oficial of TARIFAS_OFICIALES) {
    if (oficial.toLowerCase() === t.toLowerCase()) {
      return oficial;
    }
  }

  // Normalizaciones directas conocidas
  const upper = t.toUpperCase().replace(/\s+/g, " ");

  if (upper === "T1GI") return "T1G-I";
  if (upper === "I0") return "IO";
  if (upper === "T4RN1" || upper === "T4R") return "T4NR";
  if (upper === "1RN1") return "T1RN1";
  if (upper === "1RN3" || upper === "T1RN3") return "T1RN-3";
  if (upper === "TIR") return "T1R";
  if (upper === "TR1R-N1") return "T1R-N1";
  if (upper.startsWith("T1R-G1-N1")) return "T1R-G1-N1";
  if (upper.startsWith("T1R-N2")) return "T1R-N2";
  if (upper.startsWith("T1RN1 - G2- N2")) return "T1R-G2-N2";
  if (upper.startsWith("T1RN1")) return "T1RN1";
  if (upper.startsWith("T1R-G1-N")) return "T1R-G1-N1";

  // Búsqueda por similitud de caracteres
  const tClean = upper.replace(/[^A-Z0-9]/g, "");
  for (const oficial of TARIFAS_OFICIALES) {
    const oClean = oficial.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (tClean === oClean) {
      return oficial;
    }
  }

  // Si contiene T1G y no coincide exactamente
  if (upper.includes("T1G") && upper.includes("I")) return "T1G-I";
  if (upper.includes("T1G") && upper.includes("D")) return "T1G-D";
  if (upper.includes("T1G")) return "T1G";

  // Si contiene T1R y no coincide exactamente
  if (upper.includes("T1R") && upper.includes("N1")) return "T1R-N1";
  if (upper.includes("T1R") && upper.includes("N2")) return "T1R-N2";
  if (upper.includes("T1R") && upper.includes("N3")) return "T1R-N3";
  if (upper.includes("T1R")) return "T1R";

  return null;
}

async function main() {
  console.log("=== INICIO DE NORMALIZACIÓN DE TARIFAS OFICIALES ===\n");

  // 1. Asegurar que las 30 tarifas oficiales existan en la tabla Tarifa
  console.log("1. Asegurando tarifas oficiales en la base de datos...");
  const tarifasExistentes = await prisma.tarifa.findMany();
  const mapaExistentes = new Map<string, { id: number; nombre: string }>();
  for (const t of tarifasExistentes) {
    mapaExistentes.set(t.nombre, t);
  }

  for (const nombreOficial of TARIFAS_OFICIALES) {
    if (!mapaExistentes.has(nombreOficial)) {
      const creada = await prisma.tarifa.create({
        data: { nombre: nombreOficial },
      });
      mapaExistentes.set(nombreOficial, creada);
      console.log(`  + Creada tarifa oficial: "${nombreOficial}" (ID: ${creada.id})`);
    }
  }

  // Obtener mapa actualizado de tarifas oficiales -> id
  const tarifasOficialesDb = await prisma.tarifa.findMany({
    where: { nombre: { in: TARIFAS_OFICIALES } },
  });
  const mapaOficialesId = new Map<string, number>();
  for (const t of tarifasOficialesDb) {
    mapaOficialesId.set(t.nombre, t.id);
  }

  // 2. Resolver los casos de medidor invertido (donde la tarifa tiene un número y el medidor tiene la tarifa)
  console.log("\n2. Reparando usuarios con medidor y tarifa invertidos...");
  const tarifasNumericas = await prisma.tarifa.findMany({
    where: {
      nombre: {
        in: [
          "1059255", "1124435", "15668", "2042886", "35262920",
          "50012543", "51038099", "51061975", "51085248", "6124857", "9829388"
        ],
      },
    },
    include: { usuarios: true },
  });

  for (const tNum of tarifasNumericas) {
    for (const u of tNum.usuarios) {
      // El medidor real está en u.medidor si es una tarifa como T1G-I o T1G
      const tarifaRealTexto = u.medidor ? u.medidor.trim() : "";
      const medidorReal = tNum.nombre;

      let idNuevaTarifa = mapaOficialesId.get(tarifaRealTexto);
      if (!idNuevaTarifa) {
        const masSimilar = encontrarTarifaMasSimilar(tarifaRealTexto) || "T1G-I";
        idNuevaTarifa = mapaOficialesId.get(masSimilar);
      }

      await prisma.usuario.update({
        where: { id: u.id },
        data: {
          idTarifa: idNuevaTarifa,
          medidor: medidorReal,
        },
      });
      console.log(`  ✓ Usuario #${u.nroUsuario} (${u.nombre}): asignado Tarifa "${tarifaRealTexto}" (ID ${idNuevaTarifa}), medidor corregido a "${medidorReal}"`);
    }
  }

  // 3. Reasignar usuarios con tarifas no oficiales
  console.log("\n3. Migrando usuarios con tarifas no oficiales a su versión más similar...");
  const tarifasNoOficiales = await prisma.tarifa.findMany({
    where: {
      nombre: { notIn: TARIFAS_OFICIALES },
    },
    include: { usuarios: true },
  });

  for (const tNoOficial of tarifasNoOficiales) {
    if (tNoOficial.usuarios.length === 0) continue;

    const nombreDestino = encontrarTarifaMasSimilar(tNoOficial.nombre);
    const idDestino = nombreDestino ? mapaOficialesId.get(nombreDestino) || null : null;

    console.log(`  * Tarifa "${tNoOficial.nombre}" (${tNoOficial.usuarios.length} usuarios) ➔ ${nombreDestino ? `"${nombreDestino}" (ID ${idDestino})` : "null"}`);

    if (idDestino !== null) {
      const res = await prisma.usuario.updateMany({
        where: { idTarifa: tNoOficial.id },
        data: { idTarifa: idDestino },
      });
      console.log(`    ↳ ${res.count} usuarios actualizados a ID ${idDestino}`);
    } else {
      // Si era "-", se desvincula la tarifa
      const res = await prisma.usuario.updateMany({
        where: { idTarifa: tNoOficial.id },
        data: { idTarifa: null },
      });
      console.log(`    ↳ ${res.count} usuarios desvinculados (idTarifa = null)`);
    }
  }

  // 4. Eliminar las tarifas no oficiales de la base de datos
  console.log("\n4. Eliminando tarifas no oficiales de la base de datos...");
  const deleteResult = await prisma.tarifa.deleteMany({
    where: {
      nombre: { notIn: TARIFAS_OFICIALES },
    },
  });
  console.log(`  ✓ Eliminadas ${deleteResult.count} tarifas no oficiales.`);

  // 5. Verificación final
  const tarifasFinales = await prisma.tarifa.findMany({
    include: {
      _count: { select: { usuarios: true } },
    },
    orderBy: { nombre: "asc" },
  });

  console.log(`\n=== RESULTADO FINAL: ${tarifasFinales.length} TARIFAS EN DB ===`);
  for (const t of tarifasFinales) {
    console.log(`- ${t.nombre.padEnd(15, " ")} (ID ${t.id.toString().padStart(2, " ")}) : ${t._count.usuarios.toString().padStart(5, " ")} usuarios`);
  }

  const usuariosConTarifaInvalida = await prisma.usuario.count({
    where: {
      tarifa: {
        nombre: { notIn: TARIFAS_OFICIALES },
      },
    },
  });
  console.log(`\nUsuarios con tarifa no oficial restante: ${usuariosConTarifaInvalida}`);
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
