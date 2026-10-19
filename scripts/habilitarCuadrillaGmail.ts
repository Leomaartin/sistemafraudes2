import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2];
  const cuadrillaArg = process.argv[3];

  const cuadrillas = await prisma.cuadrilla.findMany({
    orderBy: { id: "asc" },
  });

  await prisma.usuarioSistema.deleteMany({ where: { email: null } });

  const usuariosSistema = await prisma.usuarioSistema.findMany({
    include: { cuadrilla: true },
    orderBy: { id: "asc" },
  });

  if (!email || !email.includes("@") || !cuadrillaArg || email === "--listar") {
    console.log("==================================================");
    console.log("🛠️  HABILITAR ACCESO DE GMAIL PARA CUADRILLA");
    console.log("==================================================");
    console.log("Uso:");
    console.log("  npx tsx scripts/habilitarCuadrillaGmail.ts <correo@gmail.com> <id_o_nombre_cuadrilla>\n");

    console.log("📋 Usuarios de Sistema registrados actualmente:");
    if (usuariosSistema.length === 0) {
      console.log("  (Ninguno registrado aún)");
    } else {
      usuariosSistema.forEach((u) => {
        const tipo = u.esAdmin ? "👑 Administrador" : `👷 Cuadrilla: ${u.cuadrilla?.nombre || `ID ${u.idCuadrilla}`}`;
        console.log(`  - ${u.email} | ${u.nombre || "Sin nombre"} | ${tipo} | Activo: ${u.activo ? "SÍ" : "NO"}`);
      });
    }

    console.log("\n🚛 Cuadrillas operativas disponibles:");
    cuadrillas.forEach((c) => {
      console.log(`  [ID: ${c.id}] ${c.nombre}`);
    });
    console.log("==================================================");
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();

  // Buscar la cuadrilla por ID o por nombre
  const numId = parseInt(cuadrillaArg, 10);
  let cuadrillaEncontrada = !isNaN(numId)
    ? cuadrillas.find((c) => c.id === numId)
    : null;

  if (!cuadrillaEncontrada) {
    cuadrillaEncontrada = cuadrillas.find((c) =>
      c.nombre.toLowerCase().includes(cuadrillaArg.toLowerCase().trim())
    );
  }

  if (!cuadrillaEncontrada) {
    console.error(`❌ No se encontró ninguna cuadrilla con el identificador "${cuadrillaArg}".`);
    console.log("Cuadrillas disponibles:");
    cuadrillas.forEach((c) => console.log(`  [ID: ${c.id}] ${c.nombre}`));
    process.exit(1);
  }

  console.log(`🔍 Registrando / Asignando correo: ${cleanEmail}`);
  console.log(`📌 Cuadrilla: [ID ${cuadrillaEncontrada.id}] ${cuadrillaEncontrada.nombre}...`);

  const user = await prisma.usuarioSistema.upsert({
    where: { email: cleanEmail },
    update: {
      rol: "cuadrilla",
      esAdmin: false,
      activo: true,
      idCuadrilla: cuadrillaEncontrada.id,
    },
    create: {
      nombre: `Operador - ${cuadrillaEncontrada.nombre}`,
      usuario: cleanEmail.split("@")[0],
      email: cleanEmail,
      rol: "cuadrilla",
      esAdmin: false,
      activo: true,
      idCuadrilla: cuadrillaEncontrada.id,
    },
    include: {
      cuadrilla: true,
    },
  });

  console.log("==================================================");
  console.log("✅ ¡CUADRILLA HABILITADA CORRECTAMENTE!");
  console.log(`ID Usuario: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Rol: ${user.rol}`);
  console.log(`Es Admin: ${user.esAdmin} (Acceso restringido sólo a sus usuarios)`);
  console.log(`Cuadrilla Vinculada: [ID ${user.cuadrilla?.id}] ${user.cuadrilla?.nombre}`);
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("❌ Error habilitando cuadrilla:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
