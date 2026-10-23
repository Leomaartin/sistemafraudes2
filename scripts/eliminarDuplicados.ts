import { prisma } from "../lib/prisma";

interface OpcionesScript {
  ejecutar: boolean;
  verbose: boolean;
}

/**
 * Normaliza el número de usuario quitando puntos, comas y espacios.
 * Retorna solo si es estrictamente numérico (cuenta de usuario real).
 */
function extraerNroCuentaNumerico(raw?: string | null): string | null {
  if (!raw) return null;
  const limpio = raw.trim().replace(/[.,\s]/g, "");
  // Debe ser un número de cuenta válido (evita 'directo', 'vacio', 'sin usuario', etc.)
  if (/^\d+$/.test(limpio)) {
    return limpio;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const opciones: OpcionesScript = {
    ejecutar: args.includes("--ejecutar") || args.includes("--aplicar"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };

  console.log("\n================================================================================");
  console.log("🏢 SCRIPT DE DETECCIÓN Y ELIMINACIÓN DE USUARIOS DUPLICADOS EN EDIFICIOS / PADRÓN");
  console.log("================================================================================");
  console.log(
    `Modo: ${
      opciones.ejecutar
        ? "🚀 EJECUCIÓN REAL (Se aplicarán cambios en la base de datos)"
        : "🔍 MODO SIMULACIÓN (Seguro: No modifica nada. Usa --ejecutar para aplicar)"
    }`
  );
  console.log("Validación por: NÚMERO DE USUARIO (Cuentas numéricas normalizadas)");
  console.log("Regla edificio: Eliminar sobrantes (2 o 3 repetidos) y al único restante marcarlo como INDEPENDIENTE (no depto)");
  console.log("--------------------------------------------------------------------------------\n");

  console.log("1. Cargando usuarios y relaciones desde la base de datos...");
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      ruta: true,
      observaciones: true,
      maps: true,
      medidor: true,
      latitud: true,
      longitud: true,
      fechaVto: true,
      idEstado: true,
      idTarifa: true,
      esDepartamento: true,
      idEstadoDepto: true,
      paraCorte: true,
      completado: true,
      rubroComercio: true,
      idRubro: true,
      nombreComercio: true,
      cuadrillas: { select: { id: true } },
      imagenes: { select: { id: true } },
      listadoItems: { select: { id: true, idListado: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`   Total de usuarios en la base de datos: ${usuarios.length}`);

  console.log("2. Agrupando por número de cuenta de usuario...");
  const mapaPorNro = new Map<string, typeof usuarios>();

  for (const u of usuarios) {
    const nroCuenta = extraerNroCuentaNumerico(u.nroUsuario);
    if (!nroCuenta) continue;

    if (!mapaPorNro.has(nroCuenta)) {
      mapaPorNro.set(nroCuenta, []);
    }
    mapaPorNro.get(nroCuenta)!.push(u);
  }

  // Filtrar únicamente los que tienen 2 o más registros
  const gruposDuplicados = Array.from(mapaPorNro.entries())
    .filter(([_, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  const totalCuentasDuplicadas = gruposDuplicados.length;
  const totalRegistrosInvolucrados = gruposDuplicados.reduce((acc, [_, list]) => acc + list.length, 0);
  const totalRegistrosAEliminar = totalRegistrosInvolucrados - totalCuentasDuplicadas;

  console.log(`   Cuentas de usuario con duplicados: ${totalCuentasDuplicadas}`);
  console.log(`   Total registros involucrados: ${totalRegistrosInvolucrados}`);
  console.log(`   Registros sobrantes a eliminar: ${totalRegistrosAEliminar}`);

  if (totalCuentasDuplicadas === 0) {
    console.log("\n✅ ¡No se detectaron usuarios duplicados para procesar!");
    return;
  }

  console.log("\n3. Evaluando registros para seleccionar el más completo y preparar la unificación...");

  let imagenesReasignadasTotal = 0;
  let listadosReasignadosTotal = 0;
  let convertidosAIndependienteTotal = 0;
  let usuariosEliminadosTotal = 0;

  for (let idx = 0; idx < gruposDuplicados.length; idx++) {
    const [nro, list] = gruposDuplicados[idx];

    // Criterio de scoring para seleccionar el registro "Ganador" (el más rico en información)
    function calcularPuntaje(u: (typeof usuarios)[0]): number {
      let score = 0;
      // Coordenadas válidas
      if (u.latitud !== null && u.longitud !== null) score += 50;
      // Imágenes (vitales para auditoría de fraudes)
      score += u.imagenes.length * 100;
      // Asignaciones en listados de trabajo
      score += u.listadoItems.length * 50;
      // Cuadrillas asignadas
      score += u.cuadrillas.length * 20;
      // Datos de medidor y observaciones
      if (u.medidor && u.medidor.trim() !== "") score += 15;
      if (u.observaciones && u.observaciones.trim() !== "") score += 10;
      if (u.idEstado !== null) score += 10;
      if (u.domicilio && u.domicilio.trim() !== "") score += 10;
      if (u.idTarifa !== null) score += 5;
      if (u.ruta && u.ruta.trim() !== "") score += 5;
      // En igualdad de condiciones, preferir el registro original (id más antiguo)
      score += Math.max(0, 5 - u.id / 10000);
      return score;
    }

    const candidatosOrdenados = [...list].sort((a, b) => calcularPuntaje(b) - calcularPuntaje(a));
    const ganador = candidatosOrdenados[0];
    const sobrantes = candidatosOrdenados.slice(1);

    // Contabilizar conversión a independiente si alguno tenía marca de edificio/depto
    const teniaMarcaDepto = list.some((u) => u.esDepartamento || u.idEstadoDepto !== null);
    if (teniaMarcaDepto) {
      convertidosAIndependienteTotal++;
    }

    // Datos combinados (si al ganador le falta algún dato y el sobrante lo tiene, se hereda)
    const latitud = ganador.latitud ?? sobrantes.find((s) => s.latitud !== null)?.latitud ?? null;
    const longitud = ganador.longitud ?? sobrantes.find((s) => s.longitud !== null)?.longitud ?? null;
    const maps = ganador.maps || sobrantes.find((s) => s.maps)?.maps || null;
    const medidor = ganador.medidor || sobrantes.find((s) => s.medidor)?.medidor || null;
    const domicilio = ganador.domicilio || sobrantes.find((s) => s.domicilio)?.domicilio || null;
    const ruta = ganador.ruta || sobrantes.find((s) => s.ruta)?.ruta || null;
    const fechaVto = ganador.fechaVto ?? sobrantes.find((s) => s.fechaVto !== null)?.fechaVto ?? null;
    const idEstado = ganador.idEstado ?? sobrantes.find((s) => s.idEstado !== null)?.idEstado ?? null;
    const idTarifa = ganador.idTarifa ?? sobrantes.find((s) => s.idTarifa !== null)?.idTarifa ?? null;
    const rubroComercio = ganador.rubroComercio || sobrantes.find((s) => s.rubroComercio)?.rubroComercio || null;
    const idRubro = ganador.idRubro ?? sobrantes.find((s) => s.idRubro !== null)?.idRubro ?? null;
    const nombreComercio = ganador.nombreComercio || sobrantes.find((s) => s.nombreComercio)?.nombreComercio || null;
    const paraCorte = ganador.paraCorte || sobrantes.some((s) => s.paraCorte);
    const completado = ganador.completado || sobrantes.some((s) => s.completado);

    // Combinar observaciones para no perder notas importantes
    let observaciones = ganador.observaciones || "";
    for (const s of sobrantes) {
      if (s.observaciones && s.observaciones.trim() && !observaciones.includes(s.observaciones.trim())) {
        observaciones = observaciones ? `${observaciones} | ${s.observaciones.trim()}` : s.observaciones.trim();
      }
    }

    // Cuadrillas a unificar
    const cuadrillasGanadorSet = new Set(ganador.cuadrillas.map((c) => c.id));
    const nuevasCuadrillasIds = sobrantes
      .flatMap((s) => s.cuadrillas.map((c) => c.id))
      .filter((cid) => !cuadrillasGanadorSet.has(cid));

    // Contabilizar reasignación de fotos y listados
    const imagenesDelGrupo = sobrantes.reduce((acc, s) => acc + s.imagenes.length, 0);
    const listadosDelGrupo = sobrantes.reduce((acc, s) => acc + s.listadoItems.length, 0);
    imagenesReasignadasTotal += imagenesDelGrupo;
    listadosReasignadosTotal += listadosDelGrupo;

    if (opciones.verbose || idx < 6) {
      console.log(
        `\n[${idx + 1}/${totalCuentasDuplicadas}] Cuenta #${nro} (${list.length} registros repetidos):`
      );
      console.log(
        `   🏆 MANTENER ID #${ganador.id}: "${ganador.nombre}" | Dom: "${ganador.domicilio}" | Coords: ${
          ganador.latitud ? "SÍ" : "NO"
        } | Fotos: ${ganador.imagenes.length}`
      );
      for (const s of sobrantes) {
        console.log(
          `   🗑️  ELIMINAR ID #${s.id}: "${s.nombre}" | Dom: "${s.domicilio}" | Depto: ${
            s.esDepartamento ? "SÍ" : "NO"
          } | Fotos: ${s.imagenes.length}`
        );
      }
      console.log(`   🏷️  DESTINO: Marcado como INDEPENDIENTE (esDepartamento = false, idEstadoDepto = null)`);
    }

    if (opciones.ejecutar) {
      await prisma.$transaction(async (tx) => {
        // 1. Reasignar imágenes de los registros eliminados al ganador (no perder evidencias)
        for (const s of sobrantes) {
          if (s.imagenes.length > 0) {
            await tx.imagen.updateMany({
              where: { usuarioId: s.id },
              data: { usuarioId: ganador.id },
            });
          }
        }

        // 2. Reasignar listados (si el ganador ya estaba en ese listado, borrar el item duplicado)
        const ganadorListadosSet = new Set(ganador.listadoItems.map((li) => li.idListado));
        for (const s of sobrantes) {
          for (const item of s.listadoItems) {
            if (ganadorListadosSet.has(item.idListado)) {
              await tx.listadoItem.delete({ where: { id: item.id } });
            } else {
              await tx.listadoItem.update({
                where: { id: item.id },
                data: { idUsuario: ganador.id },
              });
              ganadorListadosSet.add(item.idListado);
            }
          }
        }

        // 3. Eliminar los registros duplicados sobrantes
        for (const s of sobrantes) {
          await tx.usuario.delete({ where: { id: s.id } });
          usuariosEliminadosTotal++;
        }

        // 4. Actualizar el registro ganador:
        //    - Con los datos fusionados más completos
        //    - Regla solicitada: Marcarlo como INDEPENDIENTE, NO DEPARTAMENTO
        await tx.usuario.update({
          where: { id: ganador.id },
          data: {
            latitud,
            longitud,
            maps,
            medidor,
            domicilio,
            ruta,
            fechaVto,
            idEstado,
            idTarifa,
            rubroComercio,
            idRubro,
            nombreComercio,
            paraCorte,
            completado,
            observaciones: observaciones || null,
            // Regla de departamento:
            esDepartamento: false,
            idEstadoDepto: null,
            cuadrillas:
              nuevasCuadrillasIds.length > 0
                ? {
                    connect: nuevasCuadrillasIds.map((cid) => ({ id: cid })),
                  }
                : undefined,
          },
        });
      });

      if ((idx + 1) % 100 === 0 || idx + 1 === totalCuentasDuplicadas) {
        console.log(`   Procesados: ${idx + 1}/${totalCuentasDuplicadas} cuentas...`);
      }
    }
  }

  console.log("\n================================================================================");
  console.log("📊 RESUMEN FINAL DE LA OPERACIÓN");
  console.log("================================================================================");
  console.log(
    `Estado del proceso: ${
      opciones.ejecutar
        ? "✅ CAMBIOS APLICADOS CORRECTAMENTE EN LA BASE DE DATOS"
        : "🔍 SIMULACIÓN FINALIZADA (Sin modificaciones en DB)"
    }`
  );
  console.log(`Cuentas de usuario duplicadas: ${totalCuentasDuplicadas}`);
  console.log(
    `Registros duplicados a eliminar / eliminados: ${
      opciones.ejecutar ? usuariosEliminadosTotal : totalRegistrosAEliminar
    }`
  );
  console.log(
    `Usuarios configurados como INDEPENDIENTES (no depto): ${
      opciones.ejecutar ? totalCuentasDuplicadas : convertidosAIndependienteTotal
    }`
  );
  console.log(`Evidencias fotográficas transferidas y protegidas: ${imagenesReasignadasTotal}`);
  console.log(`Ítems de listados de cuadrillas salvaguardados: ${listadosReasignadosTotal}`);

  if (!opciones.ejecutar) {
    console.log("\n👉 Para ejecutar la limpieza y aplicar los cambios reales en la base de datos:");
    console.log("   npm run limpiar:duplicados -- --ejecutar");
    console.log("   o también:");
    console.log("   npx tsx scripts/eliminarDuplicados.ts --ejecutar");
  }
  console.log("================================================================================\n");
}

main()
  .catch((err) => {
    console.error("❌ Error en script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
