import * as XLSX from "xlsx";
import { prisma } from "./prisma";
import { IDS_DEPARTAMENTO, OPCIONES_DEPARTAMENTO } from "./departamentoConfig";

export interface OpcionesProcesamiento {
  buffer?: Buffer;
  rutaArchivo?: string;
  esDryRun?: boolean;
}

export interface DetalleCambioUsuario {
  nroUsuario: string;
  nombre: string;
  esNuevo: boolean;
  cambios: string[];
}

export interface ResultadoProcesamientoExcel {
  exito: boolean;
  mensaje: string;
  totalFilas: number;
  usuariosLeidos: number;
  usuariosEncontrados: number;
  usuariosModificados: number;
  usuariosSinCambios: number;
  usuariosCreados: number;
  coordenadasPreservadas: number;
  columnasMapeadas: Record<string, string | null>;
  detallesMuestra: DetalleCambioUsuario[];
  tarifasCreadas: string[];
  estadosCreados: string[];
  errores: string[];
}

function limpiarTexto(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function normalizarClave(val: string): string {
  return val
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, ""); // Deja solo letras y números
}

function esVerdadero(val: any): boolean {
  if (!val) return false;
  const str = String(val).trim().toUpperCase();
  return ["SI", "S", "YES", "Y", "1", "TRUE", "X", "DEPTO", "EDIFICIO"].includes(str);
}

export function parsearFechaExcel(val: any): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // Número de serie de Excel (días desde 1899-12-30)
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("/") && !String(val).includes("-"))) {
    const num = Number(val);
    if (num > 1000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      return isNaN(date.getTime()) ? null : date;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // DD/MM/YYYY o DD-MM-YYYY
  const partes = str.split(/[/.-]/);
  if (partes.length === 3) {
    let dia = parseInt(partes[0], 10);
    let mes = parseInt(partes[1], 10) - 1;
    let anio = parseInt(partes[2], 10);

    if (partes[0].length === 4) {
      // YYYY-MM-DD
      anio = parseInt(partes[0], 10);
      mes = parseInt(partes[1], 10) - 1;
      dia = parseInt(partes[2], 10);
    } else if (anio < 100) {
      anio += 2000;
    }

    const d = new Date(Date.UTC(anio, mes, dia));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export async function procesarExcelUsuarios(
  opciones: OpcionesProcesamiento
): Promise<ResultadoProcesamientoExcel> {
  const { buffer, rutaArchivo, esDryRun = false } = opciones;

  let workbook: XLSX.WorkBook;
  if (buffer) {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } else if (rutaArchivo) {
    workbook = XLSX.readFile(rutaArchivo, { cellDates: true });
  } else {
    throw new Error("Debe proporcionar un buffer o la ruta del archivo Excel.");
  }

  const primeraHoja = workbook.SheetNames[0];
  const hoja = workbook.Sheets[primeraHoja];
  const filas: any[] = XLSX.utils.sheet_to_json(hoja, { raw: false, defval: "" });

  if (filas.length === 0) {
    return {
      exito: false,
      mensaje: "El archivo Excel está vacío o no contiene filas con datos.",
      totalFilas: 0,
      usuariosLeidos: 0,
      usuariosEncontrados: 0,
      usuariosModificados: 0,
      usuariosSinCambios: 0,
      usuariosCreados: 0,
      coordenadasPreservadas: 0,
      columnasMapeadas: {},
      detallesMuestra: [],
      tarifasCreadas: [],
      estadosCreados: [],
      errores: ["El archivo no tiene datos"],
    };
  }

  const sample = filas[0];
  const columnasDisponibles = Object.keys(sample);

  // Mapeador flexible de columnas
  const mapearColumna = (posibles: string[]): string | null => {
    const normalizadas = posibles.map((p) => normalizarClave(p));
    const match = columnasDisponibles.find((col) =>
      normalizadas.includes(normalizarClave(col))
    );
    return match || null;
  };

  const colUsuario = mapearColumna(["USUARIO", "NRO USUARIO", "NRO_USUARIO", "N° USUARIO", "NUMERO", "CUENTA", "ID"]);
  const colNombre = mapearColumna(["NOMBRE", "NOMBRE Y APELLIDO", "TITULAR", "RAZON SOCIAL", "CLIENTE", "NOMBRE / TITULAR"]);
  const colDomicilio = mapearColumna(["DOMICILIO", "DIRECCION", "CALLE"]);
  const colTarifa = mapearColumna(["TARIFA", "COD_TARIFA", "TARIFA_ID", "COD TARIFA"]);
  const colMedidor = mapearColumna(["MEDIDOR", "NRO_MEDIDOR", "MEDIDOR_NRO", "N° MEDIDOR"]);
  const colRuta = mapearColumna(["RUTA", "NRO_RUTA", "RECORRIDO", "RUTA / SECTOR"]);
  const colObs = mapearColumna(["OBSERVACION", "OBSERVACIONES", "OBS", "OBSERVACIÓN", "OBSERVACIONES TECNICAS"]);
  const colEstado = mapearColumna(["ESTADO", "ESTADO_USUARIO", "SITUACION", "ESTADO DEL FRAUDE"]);
  const colEdificio = mapearColumna(["EDIFICIO", "DEPTO", "DEPARTAMENTO", "ES_EDIFICIO", "ES_DEPARTAMENTO", "DEPARTAMENTO / ACCESO"]);
  const colEstadoDepto = mapearColumna(["ESTADO DEPTO", "LLAVE", "CONDICION LLAVE", "SITUACION LLAVE", "CONDICION DE LLAVE"]);
  const colFechaVto = mapearColumna(["FECHA VTO", "FECHA_VTO", "VTO", "VENCIMIENTO", "FECHA DE VENCIMIENTO", "FECHA VENCIMIENTO"]);
  const colRubro = mapearColumna(["RUBRO", "RUBRO COMERCIO", "RUBRO_COMERCIO", "TIPO DE COMERCIO", "TIPO DE COMERCIO / RUBRO", "TIPO COMERCIO"]);
  const colNombreComercio = mapearColumna(["NOMBRE COMERCIO", "NOMBRE_COMERCIO", "NOMBRE INFORMAL", "NOMBRE INFORMAL COMERCIO", "FANTASIA"]);
  const colCuadrilla = mapearColumna(["CUADRILLA", "CUADRILLAS", "CUADRILLAS ASIGNADAS", "GRUPO"]);
  const colMaps = mapearColumna(["MAPS", "LINK MAPS", "GOOGLE MAPS", "ENLACE GOOGLE MAPS", "URL MAPS"]);

  const columnasMapeadas = {
    usuario: colUsuario,
    nombre: colNombre,
    domicilio: colDomicilio,
    tarifa: colTarifa,
    medidor: colMedidor,
    ruta: colRuta,
    observaciones: colObs,
    estado: colEstado,
    edificio: colEdificio,
    estadoDepto: colEstadoDepto,
    fechaVto: colFechaVto,
    rubro: colRubro,
    nombreComercio: colNombreComercio,
    cuadrilla: colCuadrilla,
    maps: colMaps,
  };

  if (!colUsuario && !colNombre) {
    return {
      exito: false,
      mensaje: "No se encontraron las columnas obligatorias de 'USUARIO' o 'NOMBRE' en el archivo Excel.",
      totalFilas: filas.length,
      usuariosLeidos: 0,
      usuariosEncontrados: 0,
      usuariosModificados: 0,
      usuariosSinCambios: 0,
      usuariosCreados: 0,
      coordenadasPreservadas: 0,
      columnasMapeadas,
      detallesMuestra: [],
      tarifasCreadas: [],
      estadosCreados: [],
      errores: ["Faltan columnas obligatorias (USUARIO o NOMBRE)"],
    };
  }

  // 1. Cargar datos existentes en BD
  const [usuariosEnDb, tarifasEnDb, estadosEnDb, rubrosEnDb, cuadrillasEnDb] = await Promise.all([
    prisma.usuario.findMany({
      select: {
        id: true,
        nroUsuario: true,
        nombre: true,
        domicilio: true,
        medidor: true,
        ruta: true,
        observaciones: true,
        idTarifa: true,
        idEstado: true,
        esDepartamento: true,
        idEstadoDepto: true,
        fechaVto: true,
        rubroComercio: true,
        idRubro: true,
        nombreComercio: true,
        maps: true,
        latitud: true,
        longitud: true,
      },
    }),
    prisma.tarifa.findMany(),
    prisma.estado.findMany(),
    prisma.rubro.findMany(),
    prisma.cuadrilla.findMany(),
  ]);

  // Indexar mapas en memoria con listas para soportar todas las filas
  const usuariosDbEmparejados = new Set<number>();
  const mapaPorNroYNombre = new Map<string, any[]>();
  const mapaPorNro = new Map<string, any[]>();
  const mapaPorNombre = new Map<string, any[]>();

  for (const u of usuariosEnDb) {
    const nroNorm = u.nroUsuario ? normalizarClave(u.nroUsuario) : "";
    const nomNorm = u.nombre ? normalizarClave(u.nombre) : "";

    if (nroNorm && nomNorm) {
      const compKey = `${nroNorm}|${nomNorm}`;
      if (!mapaPorNroYNombre.has(compKey)) mapaPorNroYNombre.set(compKey, []);
      mapaPorNroYNombre.get(compKey)!.push(u);
    }

    if (nroNorm) {
      if (!mapaPorNro.has(nroNorm)) mapaPorNro.set(nroNorm, []);
      mapaPorNro.get(nroNorm)!.push(u);
    }

    if (nomNorm) {
      if (!mapaPorNombre.has(nomNorm)) mapaPorNombre.set(nomNorm, []);
      mapaPorNombre.get(nomNorm)!.push(u);
    }
  }

  const mapaTarifas = new Map<string, { id: number; nombre: string }>();
  for (const t of tarifasEnDb) mapaTarifas.set(normalizarClave(t.nombre), t);

  const mapaEstados = new Map<string, { id: number; nombre: string }>();
  for (const e of estadosEnDb) mapaEstados.set(normalizarClave(e.nombre), e);

  const mapaRubros = new Map<string, { id: number; nombre: string }>();
  for (const r of rubrosEnDb) mapaRubros.set(normalizarClave(r.nombre), r);

  const mapaCuadrillas = new Map<string, { id: number; nombre: string }>();
  for (const c of cuadrillasEnDb) mapaCuadrillas.set(normalizarClave(c.nombre), c);

  // Mapeo de estados de departamento
  const NOMBRES_DEPTO_OPCIONES = OPCIONES_DEPARTAMENTO.map((opc) => ({
    id: opc.id,
    clave: normalizarClave(opc.nombre),
  }));

  const resolverEstadoDepto = (texto: string): number | null => {
    if (!texto) return null;
    const norm = normalizarClave(texto);
    const encontrado = NOMBRES_DEPTO_OPCIONES.find((o) => norm.includes(o.clave) || o.clave.includes(norm));
    return encontrado ? encontrado.id : null;
  };

  // Recolectar nuevos catálogos que aparezcan en el Excel
  const tarifasNuevasNombres = new Set<string>();
  const estadosNuevosNombres = new Set<string>();

  for (const fila of filas) {
    if (colTarifa && fila[colTarifa]) {
      const tNom = limpiarTexto(fila[colTarifa]);
      if (tNom && !mapaTarifas.has(normalizarClave(tNom))) {
        tarifasNuevasNombres.add(tNom);
      }
    }
    if (colEstado && fila[colEstado]) {
      const eNom = limpiarTexto(fila[colEstado]);
      if (eNom && !mapaEstados.has(normalizarClave(eNom))) {
        if (!resolverEstadoDepto(eNom)) {
          estadosNuevosNombres.add(eNom);
        }
      }
    }
  }

  // Si no es dry-run, crear las tarifas y estados nuevos primero
  if (!esDryRun) {
    for (const t of tarifasNuevasNombres) {
      try {
        const creada = await prisma.tarifa.create({ data: { nombre: t } });
        mapaTarifas.set(normalizarClave(t), creada);
      } catch {}
    }

    for (const e of estadosNuevosNombres) {
      try {
        const creado = await prisma.estado.create({ data: { nombre: e } });
        mapaEstados.set(normalizarClave(e), creado);
      } catch {}
    }
  }

  // Preparar listas de operaciones
  const usuariosParaActualizar: Array<{ id: number; data: any; cambios: string[]; nroUsuario: string; nombre: string }> = [];
  const usuariosParaInsertar: Array<{ data: any; nroUsuario: string; nombre: string }> = [];
  let usuariosSinCambios = 0;
  let coordenadasPreservadas = 0;
  let totalFilasProcesadas = 0;
  const detallesMuestra: DetalleCambioUsuario[] = [];
  const firmasExactasVistas = new Set<string>();

  for (const fila of filas) {
    const rawNroUsuario = colUsuario ? limpiarTexto(fila[colUsuario]) : "";
    const rawNombre = colNombre ? limpiarTexto(fila[colNombre]) : "";
    const domicilio = colDomicilio ? limpiarTexto(fila[colDomicilio]) || null : null;
    const medidor = colMedidor ? limpiarTexto(fila[colMedidor]) || null : null;
    const ruta = colRuta ? limpiarTexto(fila[colRuta]) || null : null;
    const observaciones = colObs ? limpiarTexto(fila[colObs]) || null : null;
    const maps = colMaps ? limpiarTexto(fila[colMaps]) || null : null;
    const fechaVto = colFechaVto ? parsearFechaExcel(fila[colFechaVto]) : null;

    // Si la fila está 100% en blanco (sin usuario, nombre, domicilio, medidor ni observaciones), omitir
    if (!rawNroUsuario && !rawNombre && !domicilio && !medidor && !observaciones) {
      continue;
    }

    const nroNorm = rawNroUsuario ? normalizarClave(rawNroUsuario) : "";
    const nomNorm = rawNombre ? normalizarClave(rawNombre) : "";
    const esNroGenerico = !nroNorm || ["DIRECTO", "VACIO", "SINUSUARIO", "SINDATO"].includes(nroNorm);

    // Filtrar duplicados 100% exactos (misma cuenta, nombre, domicilio, medidor y observación)
    const firmaFilaExacta = `${nroNorm}|${nomNorm}|${domicilio ? normalizarClave(domicilio) : ""}|${medidor ? normalizarClave(medidor) : ""}|${observaciones ? normalizarClave(observaciones) : ""}`;
    if (firmasExactasVistas.has(firmaFilaExacta)) {
      continue;
    }
    firmasExactasVistas.add(firmaFilaExacta);

    totalFilasProcesadas++;

    // Buscar si existe en BD por prioridad:
    let usuarioDb: any = null;

    // 1. Prioridad: Match exacto por N° Usuario Y Nombre
    if (nroNorm && nomNorm) {
      const candidatos = mapaPorNroYNombre.get(`${nroNorm}|${nomNorm}`) || [];
      usuarioDb = candidatos.find((c) => !usuariosDbEmparejados.has(c.id)) || null;
    }

    // 2. Prioridad: Match por N° Usuario (si no es genérico como "directo")
    if (!usuarioDb && nroNorm && !esNroGenerico) {
      const candidatos = mapaPorNro.get(nroNorm) || [];
      usuarioDb = candidatos.find((c) => !usuariosDbEmparejados.has(c.id)) || null;
    }

    // 3. Prioridad: Match por Nombre (si no tiene nro específico o es genérico)
    if (!usuarioDb && nomNorm && nomNorm.length > 3 && esNroGenerico) {
      const candidatos = mapaPorNombre.get(nomNorm) || [];
      usuarioDb = candidatos.find((c) => !usuariosDbEmparejados.has(c.id)) || null;
    }

    if (usuarioDb) {
      usuariosDbEmparejados.add(usuarioDb.id);
    }

    // Tarifa
    let idTarifa: number | null = null;
    if (colTarifa && fila[colTarifa]) {
      const tarObj = mapaTarifas.get(normalizarClave(limpiarTexto(fila[colTarifa])));
      if (tarObj) idTarifa = tarObj.id;
    }

    // Departamento y Llave
    let esDepto = false;
    let idEstadoDepto: number | null = null;

    const valEdificio = colEdificio ? fila[colEdificio] : null;
    const valEstadoDepto = colEstadoDepto ? fila[colEstadoDepto] : null;

    if (valEstadoDepto) {
      idEstadoDepto = resolverEstadoDepto(limpiarTexto(valEstadoDepto));
      if (idEstadoDepto) esDepto = true;
    }

    if (valEdificio) {
      const deptoDesdeEdificio = resolverEstadoDepto(limpiarTexto(valEdificio));
      if (deptoDesdeEdificio) {
        idEstadoDepto = deptoDesdeEdificio;
        esDepto = true;
      } else if (esVerdadero(valEdificio)) {
        esDepto = true;
      }
    }

    // Estado del Fraude
    let idEstado: number | null = null;
    if (colEstado && fila[colEstado]) {
      const estTxt = limpiarTexto(fila[colEstado]);
      const deptoId = resolverEstadoDepto(estTxt);
      if (deptoId) {
        idEstadoDepto = deptoId;
        esDepto = true;
      } else {
        const estObj = mapaEstados.get(normalizarClave(estTxt));
        if (estObj) {
          if (IDS_DEPARTAMENTO.includes(estObj.id)) {
            idEstadoDepto = estObj.id;
            esDepto = true;
          } else {
            idEstado = estObj.id;
          }
        }
      }
    }

    // Rubro y Comercio
    let rubroComercio: string | null = null;
    let idRubro: number | null = null;
    if (colRubro && fila[colRubro]) {
      rubroComercio = limpiarTexto(fila[colRubro]) || null;
      if (rubroComercio) {
        const rubroObj = mapaRubros.get(normalizarClave(rubroComercio));
        if (rubroObj) idRubro = rubroObj.id;
      }
    }

    let nombreComercio: string | null = null;
    if (colNombreComercio && fila[colNombreComercio]) {
      nombreComercio = limpiarTexto(fila[colNombreComercio]) || null;
    }

    // CASO 1: EL USUARIO YA EXISTE -> COMPARAR Y MODIFICAR (PRESERVANDO LAT/LNG)
    if (usuarioDb) {
      const cambios: string[] = [];
      const updatePayload: any = {};

      // Si el usuario en BD ya tenía coordenadas, se preservan intactas
      if (usuarioDb.latitud !== null && usuarioDb.longitud !== null) {
        coordenadasPreservadas++;
      }

      // Comparar nombre
      if (rawNombre && rawNombre !== usuarioDb.nombre) {
        cambios.push(`Nombre: "${usuarioDb.nombre}" ➔ "${rawNombre}"`);
        updatePayload.nombre = rawNombre;
      }

      // Comparar domicilio
      if (colDomicilio && domicilio !== null && domicilio !== (usuarioDb.domicilio || "")) {
        cambios.push(`Domicilio: "${usuarioDb.domicilio || "—"}" ➔ "${domicilio}"`);
        updatePayload.domicilio = domicilio;
      }

      // Comparar medidor
      if (colMedidor && medidor !== null && medidor !== (usuarioDb.medidor || "")) {
        cambios.push(`Medidor: "${usuarioDb.medidor || "—"}" ➔ "${medidor}"`);
        updatePayload.medidor = medidor;
      }

      // Comparar ruta
      if (colRuta && ruta !== null && ruta !== (usuarioDb.ruta || "")) {
        cambios.push(`Ruta: "${usuarioDb.ruta || "—"}" ➔ "${ruta}"`);
        updatePayload.ruta = ruta;
      }

      // Comparar observaciones
      if (colObs && observaciones !== null && observaciones !== (usuarioDb.observaciones || "")) {
        cambios.push(`Observaciones actualizadas`);
        updatePayload.observaciones = observaciones;
      }

      // Comparar Tarifa
      if (colTarifa && idTarifa !== null && idTarifa !== usuarioDb.idTarifa) {
        cambios.push(`Tarifa ID: ${usuarioDb.idTarifa || "—"} ➔ ${idTarifa}`);
        updatePayload.idTarifa = idTarifa;
      }

      // Comparar Estado
      if (colEstado && idEstado !== null && idEstado !== usuarioDb.idEstado) {
        cambios.push(`Estado ID: ${usuarioDb.idEstado || "—"} ➔ ${idEstado}`);
        updatePayload.idEstado = idEstado;
      }

      // Comparar Departamento / Edificio
      if ((colEdificio || colEstadoDepto) && esDepto !== usuarioDb.esDepartamento) {
        cambios.push(`¿Es departamento?: ${usuarioDb.esDepartamento ? "SÍ" : "NO"} ➔ ${esDepto ? "SÍ" : "NO"}`);
        updatePayload.esDepartamento = esDepto;
      }

      if (idEstadoDepto !== null && idEstadoDepto !== usuarioDb.idEstadoDepto) {
        cambios.push(`Condición Llave ID: ${usuarioDb.idEstadoDepto || "—"} ➔ ${idEstadoDepto}`);
        updatePayload.idEstadoDepto = idEstadoDepto;
        updatePayload.esDepartamento = true;
      }

      // Comparar Fecha Vto
      if (colFechaVto && fechaVto) {
        const fechaActualDb = usuarioDb.fechaVto ? new Date(usuarioDb.fechaVto).toISOString().split("T")[0] : "";
        const fechaNueva = fechaVto.toISOString().split("T")[0];
        if (fechaActualDb !== fechaNueva) {
          cambios.push(`Fecha Vto: ${fechaActualDb || "—"} ➔ ${fechaNueva}`);
          updatePayload.fechaVto = fechaVto;
        }
      }

      // Comparar Comercio
      if (colRubro && rubroComercio !== null && rubroComercio !== (usuarioDb.rubroComercio || "")) {
        cambios.push(`Rubro: "${usuarioDb.rubroComercio || "—"}" ➔ "${rubroComercio}"`);
        updatePayload.rubroComercio = rubroComercio;
        if (idRubro) updatePayload.idRubro = idRubro;
      }

      if (colNombreComercio && nombreComercio !== null && nombreComercio !== (usuarioDb.nombreComercio || "")) {
        cambios.push(`Nombre Comercio: "${usuarioDb.nombreComercio || "—"}" ➔ "${nombreComercio}"`);
        updatePayload.nombreComercio = nombreComercio;
      }

      // Comparar Maps
      if (colMaps && maps !== null && maps !== (usuarioDb.maps || "")) {
        cambios.push(`Maps URL actualizado`);
        updatePayload.maps = maps;
      }

      // NOTA CRÍTICA: NO SE INCLUYEN latitud NI longitud EN updatePayload (se mantienen intactas).

      if (cambios.length > 0) {
        usuariosParaActualizar.push({
          id: usuarioDb.id,
          data: updatePayload,
          cambios,
          nroUsuario: usuarioDb.nroUsuario || rawNroUsuario,
          nombre: usuarioDb.nombre || rawNombre,
        });

        if (detallesMuestra.length < 30) {
          detallesMuestra.push({
            nroUsuario: usuarioDb.nroUsuario || rawNroUsuario,
            nombre: usuarioDb.nombre || rawNombre,
            esNuevo: false,
            cambios,
          });
        }
      } else {
        usuariosSinCambios++;
      }
    } else {
      // CASO 2: EL USUARIO NO EXISTE O ES FILA ADICIONAL/REPETIDA/DIRECTO -> AGREGARLO A LA BASE DE DATOS
      const finalNroUsuario = rawNroUsuario || "SIN USUARIO";
      const finalNombre = rawNombre || (domicilio ? `DIRECTO - ${domicilio}` : "SIN NOMBRE");

      const insertData: any = {
        nroUsuario: finalNroUsuario,
        nombre: finalNombre,
        domicilio,
        medidor,
        ruta,
        observaciones,
        maps,
        esDepartamento: esDepto,
        idEstadoDepto,
        idEstado,
        idTarifa,
        idRubro,
        rubroComercio,
        nombreComercio,
        fechaVto,
      };

      usuariosParaInsertar.push({
        data: insertData,
        nroUsuario: insertData.nroUsuario,
        nombre: insertData.nombre,
      });

      const yaTeniaFilaPrevia = !!(nroNorm && mapaPorNro.get(nroNorm)?.length);

      if (detallesMuestra.length < 30) {
        detallesMuestra.push({
          nroUsuario: insertData.nroUsuario,
          nombre: insertData.nombre,
          esNuevo: true,
          cambios: [
            yaTeniaFilaPrevia
              ? "Fila adicional / inspección duplicada del mismo usuario en el Excel"
              : "Usuario nuevo agregado a la base de datos",
          ],
        });
      }
    }
  }

  // 2. Ejecutar cambios en BD si no es dry-run
  const errores: string[] = [];

  if (!esDryRun) {
    // A) Insertar usuarios nuevos en bloques
    if (usuariosParaInsertar.length > 0) {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < usuariosParaInsertar.length; i += CHUNK_SIZE) {
        const lote = usuariosParaInsertar.slice(i, i + CHUNK_SIZE).map((u) => u.data);
        try {
          await prisma.usuario.createMany({
            data: lote,
            skipDuplicates: true,
          });
        } catch (err: any) {
          errores.push(`Error al insertar lote ${i}: ${err.message}`);
        }
      }
    }

    // B) Actualizar usuarios modificados concurrentemente en lotes
    if (usuariosParaActualizar.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < usuariosParaActualizar.length; i += BATCH_SIZE) {
        const lote = usuariosParaActualizar.slice(i, i + BATCH_SIZE);
        await Promise.all(
          lote.map(async (item) => {
            try {
              await prisma.usuario.update({
                where: { id: item.id },
                data: item.data,
              });
            } catch (err: any) {
              errores.push(`Error al actualizar usuario #${item.nroUsuario}: ${err.message}`);
            }
          })
        );
      }
    }
  }

  return {
    exito: true,
    mensaje: esDryRun
      ? "Simulación (Dry-Run) completada exitosamente sin modificar la base de datos."
      : "Procesamiento y sincronización completada exitosamente.",
    totalFilas: filas.length,
    usuariosLeidos: totalFilasProcesadas,
    usuariosEncontrados: usuariosParaActualizar.length + usuariosSinCambios,
    usuariosModificados: usuariosParaActualizar.length,
    usuariosSinCambios,
    usuariosCreados: usuariosParaInsertar.length,
    coordenadasPreservadas,
    columnasMapeadas,
    detallesMuestra,
    tarifasCreadas: Array.from(tarifasNuevasNombres),
    estadosCreados: Array.from(estadosNuevosNombres),
    errores,
  };
}
