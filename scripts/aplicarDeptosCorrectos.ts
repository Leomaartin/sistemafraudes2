import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("1. Verificando o creando estados de departamento en la tabla Estado...");
  const deptoNombres = [
    "SIN LLAVE",
    "CON LLAVE / FACTURACION",
    "NO TENEMOS LLAVE",
    "PORTERO/ADMINISTRACION",
  ];

  const deptoMap = new Map<string, number>();

  for (const nombre of deptoNombres) {
    let estado = await prisma.estado.findFirst({
      where: {
        nombre: { equals: nombre, mode: "insensitive" }
      }
    });

    if (!estado) {
      estado = await prisma.estado.create({
        data: { nombre }
      });
      console.log(`+ Creado Estado: "${estado.nombre}" con ID: ${estado.id}`);
    } else {
      console.log(`= Ya existía Estado: "${estado.nombre}" con ID: ${estado.id}`);
    }
    deptoMap.set(nombre.toUpperCase(), estado.id);
  }

  console.log("\nMapeo de estados de departamento:", Object.fromEntries(deptoMap));

  // 2. Leer migracion/usuarios.xlsx
  console.log("\n2. Leyendo migracion/usuarios.xlsx...");
  const wb = XLSX.readFile("migracion/usuarios.xlsx");
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  let actualizados = 0;
  let noEncontrados = 0;

  for (const row of rows) {
    const rawEd = String(row["EDIFICIO"] || "").trim().toUpperCase();
    if (!rawEd) continue;

    const nroUsuario = String(row["USUARIO"]).trim();
    if (!nroUsuario) continue;

    const idEstadoDepto = deptoMap.get(rawEd) || null;

    const user = await prisma.usuario.findUnique({
      where: { nroUsuario }
    });

    if (user) {
      await prisma.usuario.update({
        where: { nroUsuario },
        data: {
          esDepartamento: true,
          idEstadoDepto: idEstadoDepto || user.idEstadoDepto
        }
      });
      actualizados++;
    } else {
      noEncontrados++;
    }
  }

  // Corregir usuario 28 si tenía el id viejo 14
  const sinLlaveId = deptoMap.get("SIN LLAVE");
  if (sinLlaveId) {
    await prisma.usuario.updateMany({
      where: { idEstadoDepto: 14 },
      data: { idEstadoDepto: sinLlaveId }
    });
  }

  console.log(`\n✅ Proceso completado:`);
  console.log(`- Usuarios actualizados como departamento: ${actualizados}`);
  console.log(`- No encontrados: ${noEncontrados}`);

  const totalDeptosDb = await prisma.usuario.count({
    where: { esDepartamento: true }
  });
  console.log(`\n🏢 Total de departamentos en base de datos ahora: ${totalDeptosDb}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
