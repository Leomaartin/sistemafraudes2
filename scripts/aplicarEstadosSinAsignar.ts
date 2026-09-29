import { prisma } from "../lib/prisma";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`\n=== ASIGNACIÓN MASIVA DE ESTADOS A USUARIOS (dry-run: ${isDryRun}) ===\n`);

  // 1. Obtener o crear los estados necesarios
  let estados = await prisma.estado.findMany();
  console.log("Estados actuales en BD:");
  estados.forEach((e) => console.log(`  [${e.id}] ${e.nombre}`));

  async function getOrCreateEstado(nombre: string): Promise<number> {
    const existing = estados.find(
      (e) => e.nombre.trim().toUpperCase() === nombre.trim().toUpperCase()
    );
    if (existing) return existing.id;

    if (isDryRun) {
      console.log(`[DRY-RUN] Se crearía el estado: "${nombre}"`);
      return -1;
    }

    const created = await prisma.estado.create({
      data: { nombre: nombre.toUpperCase() },
    });
    console.log(`✅ Creado nuevo estado en BD: [${created.id}] ${created.nombre}`);
    estados.push(created);
    return created.id;
  }

  // Asegurar IDs para cada categoría
  const idFraude = estados.find((e) => e.nombre.toUpperCase() === "FRAUDE")?.id || 7;
  const idNotificado = estados.find((e) => e.nombre.toUpperCase() === "NOTIFICADO")?.id || 4;
  const idSuspendido = estados.find((e) => e.nombre.toUpperCase() === "SUSPENDIDO")?.id || 5;
  const idRetirado = estados.find((e) => e.nombre.toUpperCase() === "RETIRADO")?.id || 12;
  const idBaja = estados.find((e) => e.nombre.toUpperCase() === "BAJA")?.id || 3;
  const idTiempo = estados.find((e) => e.nombre.toUpperCase() === "TIEMPO")?.id || 8;

  // Nuevos estados requeridos para que no se pierda la precisión
  const idSinFraude = await getOrCreateEstado("SIN FRAUDE");
  const idCorte = await getOrCreateEstado("CORTE");
  const idCorteFraude = await getOrCreateEstado("CORTE / FRAUDE");

  console.log("\nMapeo de IDs a utilizar:");
  console.log(`  FRAUDE: ${idFraude}`);
  console.log(`  SIN FRAUDE: ${idSinFraude}`);
  console.log(`  CORTE / FRAUDE: ${idCorteFraude}`);
  console.log(`  CORTE: ${idCorte}`);
  console.log(`  NOTIFICADO: ${idNotificado}`);
  console.log(`  SUSPENDIDO: ${idSuspendido}`);
  console.log(`  RETIRADO: ${idRetirado}`);
  console.log(`  BAJA: ${idBaja}`);
  console.log(`  TIEMPO: ${idTiempo}`);

  // 2. Traer usuarios con idEstado: null
  const users = await prisma.usuario.findMany({
    where: { idEstado: null },
    select: { id: true, observaciones: true },
  });

  console.log(`\nUsuarios sin estado analizados: ${users.length}`);

  // Reglas de clasificación
  const toUpdate: { id: number; targetEstadoId: number; label: string }[] = [];
  const noAsignados: { id: number; obs: string | null }[] = [];

  for (const u of users) {
    const rawObs = u.observaciones;
    if (!rawObs || !rawObs.trim()) {
      noAsignados.push({ id: u.id, obs: rawObs });
      continue;
    }

    const obs = rawObs.toUpperCase();

    // Sin fraude explícito
    const sinFraudeRegex = /(?:SIN|NO|NO\s+HAY|REVISADO\s+SIN)\s+FR?AU?DE|\bS\/F\b|REVISADO\s+OK|TODO\s+OK/i;
    const tieneSinFraude = sinFraudeRegex.test(obs);
    const obsSinNegacion = obs.replace(sinFraudeRegex, "");
    const tieneFraude =
      /\bFRAUDE\b/i.test(obsSinNegacion) ||
      /ENGANCHE|CLANDESTINO|DIRECTO\s+SIN\s+MEDIDOR|ACTA\s+\d+|L[IÍ]NEA\s+PARALELA/i.test(obsSinNegacion);

    if (tieneSinFraude && !tieneFraude) {
      toUpdate.push({ id: u.id, targetEstadoId: idSinFraude, label: "SIN FRAUDE" });
      continue;
    }

    if (/CORTE.*FRAUDE|FRAUDE.*CORTE/i.test(obsSinNegacion)) {
      toUpdate.push({ id: u.id, targetEstadoId: idCorteFraude, label: "CORTE / FRAUDE" });
      continue;
    }

    if (tieneFraude) {
      toUpdate.push({ id: u.id, targetEstadoId: idFraude, label: "FRAUDE" });
      continue;
    }

    if (/\b(?:PARA\s+CORTE|CORTADO|CORTE|CORTAR)\b/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idCorte, label: "CORTE" });
      continue;
    }

    if (/NOTIFIC(?:AR|AD[OA]|ACI[OÓ]N|ACIONES?)|\bNOTF\b/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idNotificado, label: "NOTIFICADO" });
      continue;
    }

    if (/U?SUSPEND(?:ER|ID[OA]|I[DO])|\bSUSP\b/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idSuspendido, label: "SUSPENDIDO" });
      continue;
    }

    if (/RETIR(?:AR|AD[OA]|O)|MEDIDOR\s+RETIRADO/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idRetirado, label: "RETIRADO" });
      continue;
    }

    if (/\bBAJA\b|DADO\s+DE\s+BAJA/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idBaja, label: "BAJA" });
      continue;
    }

    if (/\b(?:LE\s+DIERON\s+)?TIEMPO\b/i.test(obs)) {
      toUpdate.push({ id: u.id, targetEstadoId: idTiempo, label: "TIEMPO" });
      continue;
    }

    // Los no categorizados quedan en noAsignados
    noAsignados.push({ id: u.id, obs: rawObs });
  }

  // Resumen del plan
  const conteoPorLabel: Record<string, number> = {};
  for (const item of toUpdate) {
    conteoPorLabel[item.label] = (conteoPorLabel[item.label] || 0) + 1;
  }

  console.log("\n--- RESUMEN DE ACTUALIZACIÓN ---");
  for (const [label, count] of Object.entries(conteoPorLabel)) {
    console.log(`  ${label.padEnd(20)}: ${count} usuarios`);
  }
  console.log(`  TOTAL A ACTUALIZAR  : ${toUpdate.length} usuarios`);
  console.log(`  PERMANECEN SIN ESTADO: ${noAsignados.length} usuarios (sin obs o notas técnicas varias)`);

  if (isDryRun) {
    console.log("\n[DRY-RUN] No se realizaron cambios en la base de datos.");
    await prisma.$disconnect();
    return;
  }

  // 3. Ejecutar las actualizaciones en lotes
  console.log("\n🚀 Ejecutando actualizaciones en base de datos...");
  const BATCH_SIZE = 500;
  let actualizados = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      chunk.map((item) =>
        prisma.usuario.update({
          where: { id: item.id },
          data: { idEstado: item.targetEstadoId },
        })
      )
    );
    actualizados += chunk.length;
    process.stdout.write(`\rActualizados: ${actualizados} / ${toUpdate.length}`);
  }

  console.log("\n\n🎉 ¡Actualización completada exitosamente!");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error en la ejecución:", err);
  process.exit(1);
});
