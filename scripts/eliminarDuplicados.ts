import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";

interface OpcionesScript {
  ejecutar: boolean;
  verbose: boolean;
}

interface ResumenDuplicadoNombre {
  nombre: string;
  nroUsuario: string;
  totalRepetidos: number;
  ganadorId: number;
  ganadorNombre: string;
  ganadorDomicilio: string | null;
  ganadorFotos: number;
  ganadorTieneCoords: boolean;
  ganadorEstado: string | null;
  sobrantesIds: number[];
  sobrantesDetalle: {
    id: number;
    nombre: string;
    domicilio: string | null;
    esDepto: boolean;
    fotos: number;
  }[];
  estabaEnEdificio: boolean;
}

/**
 * Normaliza el número de usuario quitando puntos, comas y espacios.
 * Retorna solo si es estrictamente numérico (cuenta de usuario real).
 */
function extraerNroCuentaNumerico(raw?: string | null): string | null {
  if (!raw) return null;
  const limpio = raw.trim().replace(/[.,\s]/g, "");
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
  console.log("Criterio de conservación: PRIORIZAR FOTOS y registro más completo");
  console.log("Regla de edificio: Marcar el único usuario restante como INDEPENDIENTE (no depto)");
  console.log("--------------------------------------------------------------------------------\n");

  console.log("1. Cargando padrón completo de usuarios y sus relaciones...");
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
      estado: { select: { nombre: true } },
      cuadrillas: { select: { id: true } },
      imagenes: { select: { id: true } },
      listadoItems: { select: { id: true, idListado: true } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`   Total de usuarios en la base de datos: ${usuarios.length}`);

  console.log("2. Detectando grupos duplicados por cuenta de usuario...");
  const mapaPorNro = new Map<string, typeof usuarios>();

  for (const u of usuarios) {
    const nroCuenta = extraerNroCuentaNumerico(u.nroUsuario);
    if (!nroCuenta) continue;

    if (!mapaPorNro.has(nroCuenta)) {
      mapaPorNro.set(nroCuenta, []);
    }
    mapaPorNro.get(nroCuenta)!.push(u);
  }

  // Filtrar grupos con 2 o más registros
  const gruposDuplicadosRaw = Array.from(mapaPorNro.entries()).filter(
    ([_, list]) => list.length > 1
  );

  const totalCuentasDuplicadas = gruposDuplicadosRaw.length;
  const totalRegistrosInvolucrados = gruposDuplicadosRaw.reduce(
    (acc, [_, list]) => acc + list.length,
    0
  );
  const totalRegistrosAEliminar = totalRegistrosInvolucrados - totalCuentasDuplicadas;

  console.log(`   Cuentas de usuario duplicadas encontradas: ${totalCuentasDuplicadas}`);
  console.log(`   Total de registros repetidos involucrados: ${totalRegistrosInvolucrados}`);
  console.log(`   Registros sobrantes a eliminar: ${totalRegistrosAEliminar}`);

  if (totalCuentasDuplicadas === 0) {
    console.log("\n✅ ¡No se detectaron usuarios duplicados en la base de datos!");
    return;
  }

  console.log("\n3. Evaluando registros: priorizando fotos y mayor completitud de datos...");

  // Criterio de scoring para evaluar completitud de datos
  function calcularPuntajeCompletitud(u: (typeof usuarios)[0]): number {
    let score = 0;
    // Coordenadas válidas en mapa
    if (u.latitud !== null && u.longitud !== null) score += 50;
    // Tareas / listados de trabajo
    score += u.listadoItems.length * 30;
    // Cuadrillas asignadas
    score += u.cuadrillas.length * 15;
    // Datos técnicos y administrativos
    if (u.medidor && u.medidor.trim() !== "") score += 15;
    if (u.observaciones && u.observaciones.trim() !== "") score += 10;
    if (u.domicilio && u.domicilio.trim() !== "") score += 10;
    if (u.idEstado !== null) score += 10;
    if (u.idTarifa !== null) score += 5;
    if (u.ruta && u.ruta.trim() !== "") score += 5;
    if (u.rubroComercio || u.idRubro) score += 5;
    // Preferir registro original (id más antiguo)
    score += Math.max(0, 5 - u.id / 10000);
    return score;
  }

  const listaResumenNombres: ResumenDuplicadoNombre[] = [];
  const operacionesPorGrupo: {
    nro: string;
    ganador: (typeof usuarios)[0];
    sobrantes: typeof usuarios;
    estabaEnEdificio: boolean;
    latitud: number | null;
    longitud: number | null;
    maps: string | null;
    medidor: string | null;
    domicilio: string | null;
    ruta: string | null;
    fechaVto: Date | null;
    idEstado: number | null;
    idTarifa: number | null;
    rubroComercio: string | null;
    idRubro: number | null;
    nombreComercio: string | null;
    paraCorte: boolean;
    completado: boolean;
    observaciones: string | null;
    nuevasCuadrillasIds: number[];
  }[] = [];

  let convertidosAIndependienteTotal = 0;
  let imagenesReasignadasTotal = 0;
  let listadosReasignadosTotal = 0;

  for (const [nro, list] of gruposDuplicadosRaw) {
    // REGLA SOLICITADA:
    // 1. PRIORIZAR REGISTROS CON FOTOS (si alguno tiene fotos, se queda ese)
    // 2. Si tienen igual cantidad de fotos o ninguno tiene, se queda el más completo
    const candidatosOrdenados = [...list].sort((a, b) => {
      const diffFotos = b.imagenes.length - a.imagenes.length;
      if (diffFotos !== 0) {
        return diffFotos; // El que tiene fotos SIEMPRE gana
      }
      return calcularPuntajeCompletitud(b) - calcularPuntajeCompletitud(a);
    });

    const ganador = candidatosOrdenados[0];
    const sobrantes = candidatosOrdenados.slice(1);

    const estabaEnEdificio = list.some((u) => u.esDepartamento || u.idEstadoDepto !== null);
    if (estabaEnEdificio) {
      convertidosAIndependienteTotal++;
    }

    // Datos fusionados (para no perder información valiosa de los sobrantes)
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

    let observaciones = ganador.observaciones || "";
    for (const s of sobrantes) {
      if (s.observaciones && s.observaciones.trim() && !observaciones.includes(s.observaciones.trim())) {
        observaciones = observaciones ? `${observaciones} | ${s.observaciones.trim()}` : s.observaciones.trim();
      }
    }

    const cuadrillasGanadorSet = new Set(ganador.cuadrillas.map((c) => c.id));
    const nuevasCuadrillasIds = sobrantes
      .flatMap((s) => s.cuadrillas.map((c) => c.id))
      .filter((cid) => !cuadrillasGanadorSet.has(cid));

    imagenesReasignadasTotal += sobrantes.reduce((acc, s) => acc + s.imagenes.length, 0);
    listadosReasignadosTotal += sobrantes.reduce((acc, s) => acc + s.listadoItems.length, 0);

    const nombrePrincipal = ganador.nombre?.trim() || list[0].nombre?.trim() || "SIN NOMBRE";

    listaResumenNombres.push({
      nombre: nombrePrincipal,
      nroUsuario: nro,
      totalRepetidos: list.length,
      ganadorId: ganador.id,
      ganadorNombre: ganador.nombre,
      ganadorDomicilio: ganador.domicilio,
      ganadorFotos: ganador.imagenes.length,
      ganadorTieneCoords: Boolean(ganador.latitud && ganador.longitud),
      ganadorEstado: ganador.estado?.nombre || null,
      sobrantesIds: sobrantes.map((s) => s.id),
      sobrantesDetalle: sobrantes.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        domicilio: s.domicilio,
        esDepto: s.esDepartamento,
        fotos: s.imagenes.length,
      })),
      estabaEnEdificio,
    });

    operacionesPorGrupo.push({
      nro,
      ganador,
      sobrantes,
      estabaEnEdificio,
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
      nuevasCuadrillasIds,
    });
  }

  // Ordenar la lista alfabéticamente por NOMBRE para máxima claridad del usuario
  listaResumenNombres.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  console.log("\n================================================================================");
  console.log("📋 LISTA COMPLETA DE NOMBRES DUPLICADOS (ORDEN ALFABÉTICO)");
  console.log("================================================================================");
  console.log(
    `Total de nombres/cuentas duplicadas: ${listaResumenNombres.length} usuarios con copias`
  );
  console.log("--------------------------------------------------------------------------------");

  listaResumenNombres.forEach((item, index) => {
    const detalleFotos =
      item.ganadorFotos > 0
        ? ` 📸 [TIENE ${item.ganadorFotos} FOTOS - PRIORIZADO]`
        : "";
    const detalleDepto = item.estabaEnEdificio
      ? " 🏢 [EN EDIFICIO -> CONVERTIDO A INDEPENDIENTE]"
      : "";

    console.log(
      `${(index + 1).toString().padStart(4, " ")}. "${item.nombre}" (Cuenta #${item.nroUsuario}) — ${item.totalRepetidos} copias`
    );
    console.log(
      `      🏆 CONSERVAR: ID #${item.ganadorId} | Dom: "${item.ganadorDomicilio || "S/D"}" | Coords: ${
        item.ganadorTieneCoords ? "SÍ" : "NO"
      }${detalleFotos}${detalleDepto}`
    );
    console.log(
      `      🗑️  ELIMINAR: ${item.sobrantesDetalle
        .map((s) => `ID #${s.id} ("${s.nombre}")`)
        .join(", ")}`
    );
  });

  // Guardar la lista completa en un archivo TXT y JSON para consulta rápida
  const rutaTxt = path.join(process.cwd(), "scripts", "lista_nombres_duplicados.txt");
  const rutaJson = path.join(process.cwd(), "scripts", "lista_nombres_duplicados.json");

  const lineasTxt = [
    "================================================================================",
    "REPORTE COMPLETO DE USUARIOS DUPLICADOS - SISTEMA FRAUDE",
    `Generado: ${new Date().toLocaleString("es-AR")}`,
    `Total de cuentas/nombres duplicados: ${listaResumenNombres.length}`,
    `Total de registros a eliminar: ${totalRegistrosAEliminar}`,
    "================================================================================\n",
  ];

  listaResumenNombres.forEach((item, index) => {
    lineasTxt.push(
      `#${index + 1} | NOMBRE: ${item.nombre} | CUENTA: ${item.nroUsuario} | REPETICIONES: ${item.totalRepetidos}`
    );
    lineasTxt.push(
      `   -> CONSERVAR ID: ${item.ganadorId} (Fotos: ${item.ganadorFotos}, Coords: ${item.ganadorTieneCoords ? "SI" : "NO"}, Dom: "${item.ganadorDomicilio || "S/D"}")`
    );
    lineasTxt.push(
      `   -> ELIMINAR IDS: [${item.sobrantesIds.join(", ")}]`
    );
    lineasTxt.push(
      `   -> CONDICIÓN: Marcado como INDEPENDIENTE (no depto)\n`
    );
  });

  fs.writeFileSync(rutaTxt, lineasTxt.join("\n"), "utf-8");
  fs.writeFileSync(rutaJson, JSON.stringify(listaResumenNombres, null, 2), "utf-8");

  console.log("\n================================================================================");
  console.log(`📁 Reportes exportados con éxito:`);
  console.log(`   - Texto legible: scripts/lista_nombres_duplicados.txt`);
  console.log(`   - JSON estructurado: scripts/lista_nombres_duplicados.json`);
  console.log("================================================================================");

  // Si está en modo ejecución, aplicar los cambios en la base de datos
  if (opciones.ejecutar) {
    console.log("\n4. Aplicando cambios reales en la base de datos...");
    let eliminadosTotal = 0;

    for (let i = 0; i < operacionesPorGrupo.length; i++) {
      const op = operacionesPorGrupo[i];

      await prisma.$transaction(async (tx) => {
        // 1. Reasignar imágenes de los eliminados al ganador
        for (const s of op.sobrantes) {
          if (s.imagenes.length > 0) {
            await tx.imagen.updateMany({
              where: { usuarioId: s.id },
              data: { usuarioId: op.ganador.id },
            });
          }
        }

        // 2. Reasignar listados de cuadrillas (o borrar duplicados si ya estaba)
        const ganadorListadosSet = new Set(op.ganador.listadoItems.map((li) => li.idListado));
        for (const s of op.sobrantes) {
          for (const item of s.listadoItems) {
            if (ganadorListadosSet.has(item.idListado)) {
              await tx.listadoItem.delete({ where: { id: item.id } });
            } else {
              await tx.listadoItem.update({
                where: { id: item.id },
                data: { idUsuario: op.ganador.id },
              });
              ganadorListadosSet.add(item.idListado);
            }
          }
        }

        // 3. Eliminar los registros sobrantes
        for (const s of op.sobrantes) {
          await tx.usuario.delete({ where: { id: s.id } });
          eliminadosTotal++;
        }

        // 4. Actualizar el registro ganador con datos combinados y regla independiente
        await tx.usuario.update({
          where: { id: op.ganador.id },
          data: {
            latitud: op.latitud,
            longitud: op.longitud,
            maps: op.maps,
            medidor: op.medidor,
            domicilio: op.domicilio,
            ruta: op.ruta,
            fechaVto: op.fechaVto,
            idEstado: op.idEstado,
            idTarifa: op.idTarifa,
            rubroComercio: op.rubroComercio,
            idRubro: op.idRubro,
            nombreComercio: op.nombreComercio,
            paraCorte: op.paraCorte,
            completado: op.completado,
            observaciones: op.observaciones,
            // REGLA: Independiente, no departamento
            esDepartamento: false,
            idEstadoDepto: null,
            cuadrillas:
              op.nuevasCuadrillasIds.length > 0
                ? {
                    connect: op.nuevasCuadrillasIds.map((cid) => ({ id: cid })),
                  }
                : undefined,
          },
        });
      });

      if ((i + 1) % 100 === 0 || i + 1 === operacionesPorGrupo.length) {
        console.log(`   Procesados: ${i + 1}/${operacionesPorGrupo.length} cuentas...`);
      }
    }

    console.log("\n================================================================================");
    console.log("✅ RESULTADO DE LA EJECUCIÓN REAL");
    console.log("================================================================================");
    console.log(`Usuarios sobrantes eliminados: ${eliminadosTotal}`);
    console.log(`Usuarios conservados y marcados como INDEPENDIENTES: ${operacionesPorGrupo.length}`);
    console.log(`Fotos transferidas y preservadas: ${imagenesReasignadasTotal}`);
    console.log(`Listados de trabajo reasignados: ${listadosReasignadosTotal}`);
    console.log("================================================================================\n");
  } else {
    console.log("\n================================================================================");
    console.log("📊 RESUMEN (MODO SIMULACIÓN - Sin modificar la base de datos)");
    console.log("================================================================================");
    console.log(`Cuentas de usuario duplicadas: ${totalCuentasDuplicadas}`);
    console.log(`Registros duplicados que se eliminarán: ${totalRegistrosAEliminar}`);
    console.log(`Usuarios únicos que quedarán como INDEPENDIENTES: ${totalCuentasDuplicadas}`);
    console.log(`Fotos protegidas / transferidas: ${imagenesReasignadasTotal}`);
    console.log("\n👉 Para aplicar los cambios reales en la base de datos, ejecuta:");
    console.log("   npm run limpiar:duplicados -- --ejecutar");
    console.log("================================================================================\n");
  }
}

main()
  .catch((err) => {
    console.error("❌ Error en script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
