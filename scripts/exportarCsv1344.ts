import { prisma } from "../lib/prisma";
import fs from "fs";

async function exportCsv() {
  const users = await prisma.usuario.findMany({
    where: {
      idEstado: null,
      OR: [{ observaciones: null }, { observaciones: "" }],
    },
    include: {
      tarifa: true,
      cuadrillas: true,
    },
    orderBy: { id: "asc" },
  });

  const header = "ID,NRO_USUARIO,NOMBRE,DOMICILIO,RUTA,MEDIDOR,TARIFA,ESTADO_EN_BD\n";
  const rows = users.map((u) => {
    const esc = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    return [
      u.id,
      esc(u.nroUsuario),
      esc(u.nombre),
      esc(u.domicilio),
      esc(u.ruta),
      esc(u.medidor),
      esc(u.tarifa?.nombre || "SIN TARIFA"),
      esc("SIN ESTADO (NULL)"),
    ].join(",");
  });

  fs.writeFileSync("scripts/usuarios_sin_estado_1344.csv", header + rows.join("\n"), "utf-8");
  console.log(`✅ CSV exportado con ${users.length} filas en scripts/usuarios_sin_estado_1344.csv`);

  await prisma.$disconnect();
}

exportCsv().catch(console.error);
