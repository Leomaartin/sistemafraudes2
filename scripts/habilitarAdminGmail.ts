import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2] || process.env.ALLOWED_EMAIL;

  if (!email || !email.includes("@")) {
    console.error("❌ Por favor especifica un correo válido.");
    console.log("Ejemplo de uso:");
    console.log("  npx tsx scripts/habilitarAdminGmail.ts tu-correo@gmail.com");
    process.exit(1);
  }

  const cleanEmail = email.toLowerCase().trim();
  console.log(`🔍 Registrando / Habilitando administrador con correo: ${cleanEmail}...`);

  const user = await prisma.usuarioSistema.upsert({
    where: { email: cleanEmail },
    update: {
      esAdmin: true,
      activo: true,
      rol: "administrador",
    },
    create: {
      nombre: "Administrador CEZ",
      usuario: cleanEmail.split("@")[0],
      email: cleanEmail,
      rol: "administrador",
      esAdmin: true,
      activo: true,
    },
  });

  console.log("==================================================");
  console.log("✅ ¡ADMINISTRADOR HABILITADO CORRECTAMENTE!");
  console.log(`ID: ${user.id}`);
  console.log(`Nombre: ${user.nombre}`);
  console.log(`Email: ${user.email}`);
  console.log(`Rol: ${user.rol}`);
  console.log(`Es Admin: ${user.esAdmin}`);
  console.log(`Activo: ${user.activo}`);
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("❌ Error habilitando administrador:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
