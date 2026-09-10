import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🧹 Limpiando datos de prueba...");


  await prisma.usuario.deleteMany();

  await prisma.usuarioSistema.deleteMany();
  await prisma.cuadrilla.deleteMany();
  await prisma.estado.deleteMany();
  await prisma.tarifa.deleteMany();

  console.log("✅ Datos anteriores eliminados");

  // =========================
  // ESTADOS
  // =========================

  const estados = await Promise.all([
    prisma.estado.create({
      data: {
        nombre: "Normal",
      },
    }),
    prisma.estado.create({
      data: {
        nombre: "Con deuda",
      },
    }),
    prisma.estado.create({
      data: {
        nombre: "Suspendido",
      },
    }),
    prisma.estado.create({
      data: {
        nombre: "En gestión",
      },
    }),
  ]);

  // =========================
  // TARIFAS
  // =========================

  const tarifas = await Promise.all([
    prisma.tarifa.create({
      data: {
        nombre: "Residencial",
      },
    }),
    prisma.tarifa.create({
      data: {
        nombre: "Comercial",
      },
    }),
    prisma.tarifa.create({
      data: {
        nombre: "Industrial",
      },
    }),
    prisma.tarifa.create({
      data: {
        nombre: "Social",
      },
    }),
  ]);

  // =========================
  // CUADRILLAS
  // =========================

  const cuadrillas = await Promise.all([
    prisma.cuadrilla.create({
      data: {
        nombre: "Cuadrilla Norte",
      },
    }),
    prisma.cuadrilla.create({
      data: {
        nombre: "Cuadrilla Centro",
      },
    }),
    prisma.cuadrilla.create({
      data: {
        nombre: "Cuadrilla Sur",
      },
    }),
  ]);

  // =========================
  // USUARIOS
  // =========================

  const usuarios = [
    {
      nroUsuario: "100001",
      nombre: "Juan Pérez",
      domicilio: "Av. Mitre 125",
      ruta: "Ruta 01",
      observaciones: "Usuario residencial",
      medidor: "MED-00001",
      estado: 0,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100002",
      nombre: "María González",
      domicilio: "Belgrano 452",
      ruta: "Ruta 01",
      observaciones: "Medidor exterior",
      medidor: "MED-00002",
      estado: 1,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100003",
      nombre: "Carlos Rodríguez",
      domicilio: "San Martín 830",
      ruta: "Ruta 02",
      observaciones: "Revisar instalación",
      medidor: "MED-00003",
      estado: 3,
      tarifa: 1,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100004",
      nombre: "Ana Martínez",
      domicilio: "Sarmiento 214",
      ruta: "Ruta 02",
      observaciones: "Sin observaciones",
      medidor: "MED-00004",
      estado: 0,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100005",
      nombre: "Luis Fernández",
      domicilio: "Rivadavia 1024",
      ruta: "Ruta 03",
      observaciones: "Requiere inspección",
      medidor: "MED-00005",
      estado: 2,
      tarifa: 0,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100006",
      nombre: "Laura López",
      domicilio: "Italia 568",
      ruta: "Ruta 03",
      observaciones: "Usuario residencial",
      medidor: "MED-00006",
      estado: 0,
      tarifa: 3,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100007",
      nombre: "Miguel Sánchez",
      domicilio: "España 341",
      ruta: "Ruta 04",
      observaciones: "Medidor interno",
      medidor: "MED-00007",
      estado: 1,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100008",
      nombre: "Sofía Romero",
      domicilio: "Belgrano 912",
      ruta: "Ruta 04",
      observaciones: "Sin observaciones",
      medidor: "MED-00008",
      estado: 0,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100009",
      nombre: "Diego Torres",
      domicilio: "Moreno 675",
      ruta: "Ruta 05",
      observaciones: "Verificar medidor",
      medidor: "MED-00009",
      estado: 3,
      tarifa: 1,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100010",
      nombre: "Valentina Díaz",
      domicilio: "Alsina 123",
      ruta: "Ruta 05",
      observaciones: "Usuario residencial",
      medidor: "MED-00010",
      estado: 0,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100011",
      nombre: "Federico Acosta",
      domicilio: "Lavalle 456",
      ruta: "Ruta 06",
      observaciones: "Deuda pendiente",
      medidor: "MED-00011",
      estado: 1,
      tarifa: 1,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100012",
      nombre: "Camila Herrera",
      domicilio: "Pueyrredón 782",
      ruta: "Ruta 06",
      observaciones: "Sin observaciones",
      medidor: "MED-00012",
      estado: 0,
      tarifa: 0,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100013",
      nombre: "Martín Castro",
      domicilio: "25 de Mayo 310",
      ruta: "Ruta 07",
      observaciones: "Inspección solicitada",
      medidor: "MED-00013",
      estado: 3,
      tarifa: 2,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100014",
      nombre: "Florencia Ruiz",
      domicilio: "Saavedra 541",
      ruta: "Ruta 07",
      observaciones: "Usuario residencial",
      medidor: "MED-00014",
      estado: 0,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100015",
      nombre: "Nicolás Medina",
      domicilio: "Urquiza 888",
      ruta: "Ruta 08",
      observaciones: "Medidor con inconvenientes",
      medidor: "MED-00015",
      estado: 2,
      tarifa: 1,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100016",
      nombre: "Gabriela Silva",
      domicilio: "Brown 246",
      ruta: "Ruta 08",
      observaciones: "Sin observaciones",
      medidor: "MED-00016",
      estado: 0,
      tarifa: 3,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100017",
      nombre: "Pablo Molina",
      domicilio: "Colón 734",
      ruta: "Ruta 09",
      observaciones: "Deuda pendiente",
      medidor: "MED-00017",
      estado: 1,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100018",
      nombre: "Julieta Navarro",
      domicilio: "Saavedra 120",
      ruta: "Ruta 09",
      observaciones: "Usuario residencial",
      medidor: "MED-00018",
      estado: 0,
      tarifa: 0,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100019",
      nombre: "Santiago Vega",
      domicilio: "Castelli 654",
      ruta: "Ruta 10",
      observaciones: "Revisar conexión",
      medidor: "MED-00019",
      estado: 3,
      tarifa: 1,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100020",
      nombre: "Paula Ortiz",
      domicilio: "Dorrego 321",
      ruta: "Ruta 10",
      observaciones: "Sin observaciones",
      medidor: "MED-00020",
      estado: 0,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100021",
      nombre: "Andrés Giménez",
      domicilio: "Ituzaingó 876",
      ruta: "Ruta 11",
      observaciones: "Deuda pendiente",
      medidor: "MED-00021",
      estado: 1,
      tarifa: 1,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100022",
      nombre: "Carolina Benítez",
      domicilio: "French 432",
      ruta: "Ruta 11",
      observaciones: "Usuario residencial",
      medidor: "MED-00022",
      estado: 0,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100023",
      nombre: "Rodrigo Suárez",
      domicilio: "Garay 765",
      ruta: "Ruta 12",
      observaciones: "Requiere inspección",
      medidor: "MED-00023",
      estado: 3,
      tarifa: 2,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100024",
      nombre: "Luciana Peralta",
      domicilio: "Vélez Sarsfield 234",
      ruta: "Ruta 12",
      observaciones: "Sin observaciones",
      medidor: "MED-00024",
      estado: 0,
      tarifa: 3,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100025",
      nombre: "Gonzalo Ramírez",
      domicilio: "Necochea 543",
      ruta: "Ruta 13",
      observaciones: "Medidor exterior",
      medidor: "MED-00025",
      estado: 0,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100026",
      nombre: "Micaela Campos",
      domicilio: "Alberdi 987",
      ruta: "Ruta 13",
      observaciones: "Deuda pendiente",
      medidor: "MED-00026",
      estado: 1,
      tarifa: 0,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100027",
      nombre: "Hernán Aguirre",
      domicilio: "Formosa 321",
      ruta: "Ruta 14",
      observaciones: "Revisar instalación",
      medidor: "MED-00027",
      estado: 3,
      tarifa: 1,
      cuadrilla: 2,
    },
    {
      nroUsuario: "100028",
      nombre: "Rocío Duarte",
      domicilio: "Tucumán 654",
      ruta: "Ruta 14",
      observaciones: "Usuario residencial",
      medidor: "MED-00028",
      estado: 0,
      tarifa: 0,
      cuadrilla: 0,
    },
    {
      nroUsuario: "100029",
      nombre: "Sebastián Núñez",
      domicilio: "Córdoba 876",
      ruta: "Ruta 15",
      observaciones: "Medidor con inconvenientes",
      medidor: "MED-00029",
      estado: 2,
      tarifa: 1,
      cuadrilla: 1,
    },
    {
      nroUsuario: "100030",
      nombre: "Agustina Ríos",
      domicilio: "Entre Ríos 432",
      ruta: "Ruta 15",
      observaciones: "Sin observaciones",
      medidor: "MED-00030",
      estado: 0,
      tarifa: 3,
      cuadrilla: 2,
    },
  ];

  // =========================
  // CREAR USUARIOS
  // =========================

  for (const usuario of usuarios) {
    await prisma.usuario.create({
      data: {
        nroUsuario: usuario.nroUsuario,
        nombre: usuario.nombre,
        domicilio: usuario.domicilio,
        ruta: usuario.ruta,
        observaciones: usuario.observaciones,
        maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          usuario.domicilio
        )}`,
        medidor: usuario.medidor,

        idEstado: estados[usuario.estado].id,
        idTarifa: tarifas[usuario.tarifa].id,

        cuadrillas: {
          connect: {
            id: cuadrillas[usuario.cuadrilla].id,
          },
        },
      },
    });
  }

  console.log("✅ 30 usuarios creados");

  // =========================
  // USUARIOS DEL SISTEMA
  // =========================

  await prisma.usuarioSistema.createMany({
    data: [
      {
        usuario: "admin",
        password: "admin123",
        nombre: "Administrador",
        activo: true,
      },
      {
        usuario: "operador",
        password: "operador123",
        nombre: "Operador de prueba",
        activo: true,
      },
    ],
  });

  console.log("✅ Usuarios del sistema creados");
  console.log("🎉 Seed completado correctamente");
}

main()
  .catch((error) => {
    console.error("❌ Error ejecutando seed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });