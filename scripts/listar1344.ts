import { prisma } from "../lib/prisma";
import fs from "fs";

async function main() {
  const users = await prisma.usuario.findMany({
    where: {
      OR: [{ observaciones: null }, { observaciones: "" }],
    },
    include: {
      estado: true,
      estadoDepto: true,
      tarifa: true,
      cuadrillas: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`Total usuarios con observaciones vacías: ${users.length}`);

  const conteoEstados: Record<string, number> = {};
  const conteoTarifas: Record<string, number> = {};
  const conteoDepto: Record<string, number> = {};
  const conteoCuadrilla: Record<string, number> = {};

  for (const u of users) {
    const est = u.estado?.nombre || "(SIN ESTADO / NULL)";
    conteoEstados[est] = (conteoEstados[est] || 0) + 1;

    const t = u.tarifa?.nombre || "(SIN TARIFA)";
    conteoTarifas[t] = (conteoTarifas[t] || 0) + 1;

    const dep = u.estadoDepto?.nombre || (u.esDepartamento ? "ES DEPTO (sin estado)" : "NO DEPTO");
    conteoDepto[dep] = (conteoDepto[dep] || 0) + 1;

    const cuad = u.cuadrillas.map((c) => c.nombre).join(", ") || "(SIN CUADRILLA)";
    conteoCuadrilla[cuad] = (conteoCuadrilla[cuad] || 0) + 1;
  }

  console.log("\n--- DISTRIBUCIÓN DE idEstado EN ESTOS USUARIOS ---");
  for (const [k, v] of Object.entries(conteoEstados)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n--- DISTRIBUCIÓN DE DEPARTAMENTO ---");
  for (const [k, v] of Object.entries(conteoDepto)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n--- DISTRIBUCIÓN DE TARIFAS ---");
  for (const [k, v] of Object.entries(conteoTarifas)) {
    console.log(`  ${k}: ${v}`);
  }

  // Guardar un listado completo en JSON y CSV para que el usuario pueda consultarlo o descargarlo
  const exportData = users.map((u) => ({
    id: u.id,
    nroUsuario: u.nroUsuario,
    nombre: u.nombre,
    domicilio: u.domicilio,
    ruta: u.ruta,
    medidor: u.medidor,
    idEstado: u.idEstado,
    estadoNombre: u.estado?.nombre || "SIN ESTADO",
    esDepartamento: u.esDepartamento,
    estadoDepto: u.estadoDepto?.nombre || null,
    tarifa: u.tarifa?.nombre || null,
    cuadrilla: u.cuadrillas.map((c) => c.nombre).join(" / ") || null,
    fechaVto: u.fechaVto ? u.fechaVto.toISOString().split("T")[0] : null,
  }));

  fs.writeFileSync(
    "scripts/usuarios_sin_observaciones.json",
    JSON.stringify(exportData, null, 2),
    "utf-8"
  );

  // Muestra de los primeros 15
  console.log("\n--- PRIMEROS 15 USUARIOS DE LA LISTA ---");
  console.table(
    exportData.slice(0, 15).map((x) => ({
      Nro: x.nroUsuario,
      Nombre: x.nombre,
      Domicilio: x.domicilio,
      Estado: x.estadoNombre,
      Depto: x.estadoDepto || (x.esDepartamento ? "SÍ" : "NO"),
      Tarifa: x.tarifa,
    }))
  );

  await prisma.$disconnect();
}

main().catch(console.error);
