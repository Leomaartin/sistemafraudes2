import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normalizarNombreCalle(raw: string | null): string {
  if (!raw || !raw.trim()) return "SIN DOMICILIO";
  let d = raw
    .trim()
    .toUpperCase()
    .replace(/ﾑ/g, "Ñ")
    .replace(/#/g, "Ñ")
    .replace(/･/g, "Ñ");

  // Si es un barrio privado conocido, mantener el nombre del barrio
  if (d.includes("SMITHFIELD")) return "E. Smithfield";
  if (d.includes("AMPARO")) return "El Amparo";
  if (d.includes("FLORIDA")) return "Fincas de la Florida";
  if (d.includes("FRESNOS")) return "Campos de Fresnos";
  if (d.includes("DEL CASCO") || d.includes("A.DEL CASCO")) return "Altos del Casco";
  if (d.includes("CAMPIÑA")) return "La Campiña";
  if (d.includes("COVEPAN")) return "Barrio Covepan";
  if (d.includes("VIPERMUN")) return "Barrio Vipermún";

  // Si es "CALLE <número>", ej: "CALLE 12" o "CALLE 34"
  const matchCalleNum = d.match(/^(?:CALLE|C\.)\s*(\d+[A-Z]?)\b/i);
  if (matchCalleNum) {
    return `Calle ${matchCalleNum[1]}`;
  }

  // Quitar detalles secundarios como depto, piso, lote, etc.
  let limpio = d
    .replace(/\b(PISO|DEPTO|DTO|DPTO|PB|LOCAL|CASA|MANZANA|MZ|LOTE|LT|FONDO|INTER|INTERNO|INT|FRENTE|BIS)\b.*$/i, "")
    .replace(/[,\-\/].*$/, "")
    .trim();

  // Quitar número domiciliario final si hay nombre de calle antes
  const matchNum = limpio.match(/^([A-Za-z\s\.\'\-]+?)\s+\d+/);
  if (matchNum && matchNum[1].trim().length >= 3) {
    limpio = matchNum[1].trim();
  }

  // Quitar prefijo CALLE sólo si le sigue un nombre de calle (ej: "CALLE AMEGHINO" -> "Ameghino")
  limpio = limpio.replace(/^CALLE\s+([A-Za-z])/i, "$1").trim();

  if (limpio === "CALLE" || limpio.length < 2) return "Calle No Identificada";

  // Capitalización legible (ej: AMEGHINO -> Ameghino, AV. RIVADAVIA -> Av. Rivadavia)
  return limpio
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word === "av." || word === "av" || word === "avda." || word === "avda") return "Av.";
      if (word === "pje." || word === "pje") return "Pje.";
      if (word === "b." || word === "bo" || word === "b°") return "B°";
      if (["de", "del", "la", "las", "el", "los", "y"].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rutasParam = searchParams.get("rutas");
    const callesParam = searchParams.get("calles");

    const rutasFiltro = rutasParam
      ? rutasParam.split(",").map((r) => r.trim()).filter(Boolean)
      : [];
    const rutasFiltroSet = new Set(rutasFiltro);

    const callesFiltro = callesParam
      ? callesParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [];

    const hayFiltroActivo = rutasFiltroSet.size > 0 || callesFiltro.length > 0;

    // Consulta de usuarios
    const usuarios = await prisma.usuario.findMany({
      select: {
        ruta: true,
        idEstado: true,
        domicilio: true,
        latitud: true,
        longitud: true,
        estado: {
          select: {
            nombre: true,
          },
        },
      },
    });

    // Catálogos globales
    const rutasCatalogoMap: Record<
      string,
      { ruta: string; rutaNumero: number; totalUsuarios: number; totalFraudes: number }
    > = {};

    const callesCatalogoMap: Record<
      string,
      { calle: string; totalUsuarios: number; totalFraudes: number }
    > = {};

    // Métricas del conjunto (filtrado o global)
    let totalUsuarios = 0;
    let totalFraudes = 0;
    let totalOtrosEstados = 0;
    let totalSinEstado = 0;
    let conGeo = 0;
    let sinGeo = 0;

    const desgloseFraudes: Record<string, number> = {};
    const desgloseEstados: Record<string, number> = {};

    const callesFiltradasMap: Record<
      string,
      { calle: string; totalUsuarios: number; totalFraudes: number }
    > = {};

    const rutasFiltradasMap: Record<
      string,
      {
        ruta: string;
        rutaNumero: number;
        totalUsuarios: number;
        totalFraudes: number;
        conGeo: number;
        sinGeo: number;
        desgloseFraudes: Record<string, number>;
      }
    > = {};

    for (const u of usuarios) {
      // Normalizar ruta
      const rutaRaw = u.ruta ? String(u.ruta).trim() : "SIN RUTA";
      const rutaNum = parseInt(rutaRaw, 10);
      const rutaKey = isNaN(rutaNum) ? rutaRaw : String(rutaNum);

      // Normalizar calle
      const calleNombre = normalizarNombreCalle(u.domicilio);
      const calleUpper = (u.domicilio || "").toUpperCase();

      // Estado
      const rawNombre = u.estado?.nombre?.trim().toUpperCase();
      const estadoNombre = rawNombre || "SIN ESTADO ASIGNADO";
      const esFraude = rawNombre ? estadoNombre.includes("FRAUDE") : false;

      // 1. Acumular catálogo de rutas disponibles (global)
      if (!rutasCatalogoMap[rutaKey]) {
        rutasCatalogoMap[rutaKey] = {
          ruta: rutaKey,
          rutaNumero: isNaN(rutaNum) ? 99999 : rutaNum,
          totalUsuarios: 0,
          totalFraudes: 0,
        };
      }
      rutasCatalogoMap[rutaKey].totalUsuarios++;
      if (esFraude) {
        rutasCatalogoMap[rutaKey].totalFraudes++;
      }

      // 2. Acumular catálogo de calles disponibles (global)
      if (calleNombre && calleNombre !== "SIN DOMICILIO") {
        if (!callesCatalogoMap[calleNombre]) {
          callesCatalogoMap[calleNombre] = {
            calle: calleNombre,
            totalUsuarios: 0,
            totalFraudes: 0,
          };
        }
        callesCatalogoMap[calleNombre].totalUsuarios++;
        if (esFraude) {
          callesCatalogoMap[calleNombre].totalFraudes++;
        }
      }

      // 3. Evaluar filtros
      if (rutasFiltroSet.size > 0 && !rutasFiltroSet.has(rutaKey)) {
        continue;
      }

      if (callesFiltro.length > 0) {
        const coincideCalle = callesFiltro.some(
          (c) => calleNombre.toUpperCase().includes(c) || calleUpper.includes(c)
        );
        if (!coincideCalle) {
          continue;
        }
      }

      // 4. Acumular métricas para el conjunto
      totalUsuarios++;

      if (u.latitud !== null && u.longitud !== null && !isNaN(Number(u.latitud))) {
        conGeo++;
      } else {
        sinGeo++;
      }

      desgloseEstados[estadoNombre] = (desgloseEstados[estadoNombre] || 0) + 1;

      if (!rawNombre) {
        totalSinEstado++;
      } else if (esFraude) {
        totalFraudes++;
        desgloseFraudes[estadoNombre] = (desgloseFraudes[estadoNombre] || 0) + 1;
      } else {
        totalOtrosEstados++;
      }

      // Acumular calles en la selección
      if (calleNombre && calleNombre !== "SIN DOMICILIO") {
        if (!callesFiltradasMap[calleNombre]) {
          callesFiltradasMap[calleNombre] = {
            calle: calleNombre,
            totalUsuarios: 0,
            totalFraudes: 0,
          };
        }
        callesFiltradasMap[calleNombre].totalUsuarios++;
        if (esFraude) {
          callesFiltradasMap[calleNombre].totalFraudes++;
        }
      }

      // Acumular rutas en la selección
      if (!rutasFiltradasMap[rutaKey]) {
        rutasFiltradasMap[rutaKey] = {
          ruta: rutaKey,
          rutaNumero: isNaN(rutaNum) ? 99999 : rutaNum,
          totalUsuarios: 0,
          totalFraudes: 0,
          conGeo: 0,
          sinGeo: 0,
          desgloseFraudes: {},
        };
      }

      const r = rutasFiltradasMap[rutaKey];
      r.totalUsuarios++;
      if (u.latitud !== null && u.longitud !== null) {
        r.conGeo++;
      } else {
        r.sinGeo++;
      }

      if (esFraude) {
        r.totalFraudes++;
        r.desgloseFraudes[estadoNombre] = (r.desgloseFraudes[estadoNombre] || 0) + 1;
      }
    }

    // Convertir rutas filtradas a array
    const listaRutas = Object.values(rutasFiltradasMap).map((r) => {
      const porcentajeFraude =
        r.totalUsuarios > 0 ? Number(((r.totalFraudes / r.totalUsuarios) * 100).toFixed(2)) : 0;
      const nivelRiesgo: "Alto" | "Medio" | "Bajo" =
        porcentajeFraude >= 15 ? "Alto" : porcentajeFraude >= 6 ? "Medio" : "Bajo";
      return {
        ...r,
        porcentajeFraude,
        nivelRiesgo,
      };
    });
    listaRutas.sort((a, b) => a.rutaNumero - b.rutaNumero);

    // Convertir calles filtradas a array
    const listaCalles = Object.values(callesFiltradasMap).map((c) => {
      const porcentajeFraude =
        c.totalUsuarios > 0 ? Number(((c.totalFraudes / c.totalUsuarios) * 100).toFixed(2)) : 0;
      const nivelRiesgo: "Alto" | "Medio" | "Bajo" =
        porcentajeFraude >= 15 ? "Alto" : porcentajeFraude >= 6 ? "Medio" : "Bajo";
      return {
        ...c,
        porcentajeFraude,
        nivelRiesgo,
      };
    });
    // Ordenar calles por cantidad de fraudes descendente
    listaCalles.sort((a, b) => b.totalFraudes - a.totalFraudes);

    // Top Rutas con más fraudes
    const topRutasFraude = [...listaRutas]
      .filter((r) => r.ruta !== "SIN RUTA")
      .sort((a, b) => b.totalFraudes - a.totalFraudes)
      .slice(0, 10);

    // Top Rutas por proporción
    const topRutasTasa = [...listaRutas]
      .filter((r) => r.ruta !== "SIN RUTA" && r.totalUsuarios >= 5)
      .sort((a, b) => b.porcentajeFraude - a.porcentajeFraude)
      .slice(0, 10);

    // Rutas disponibles para dropdown/select
    const rutasDisponibles = Object.values(rutasCatalogoMap)
      .map((r) => ({
        ...r,
        porcentajeFraude:
          r.totalUsuarios > 0 ? Number(((r.totalFraudes / r.totalUsuarios) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => a.rutaNumero - b.rutaNumero);

    // Calles disponibles para dropdown/select
    const callesDisponibles = Object.values(callesCatalogoMap)
      .map((c) => ({
        calle: c.calle,
        cantidad: c.totalFraudes,
        totalUsuarios: c.totalUsuarios,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 150);

    const porcentajeFraudeSobreRegistrados =
      totalUsuarios > 0 ? Number(((totalFraudes / totalUsuarios) * 100).toFixed(2)) : 0;
    const porcentajeGeoGlobal =
      totalUsuarios > 0 ? Number(((conGeo / totalUsuarios) * 100).toFixed(1)) : 0;

    const rutaMayorIncidencia = topRutasFraude[0]
      ? `Ruta ${topRutasFraude[0].ruta}`
      : "N/A";
    const calleMayorIncidencia =
      listaCalles.find(
        (c) =>
          c.calle.toLowerCase() !== "calle no identificada" &&
          c.calle.toLowerCase() !== "sin domicilio" &&
          c.calle.toLowerCase() !== "calle"
      )?.calle || "N/A";

    return NextResponse.json({
      globales: {
        totalUsuarios,
        totalFraudes,
        totalNormales: totalUsuarios - totalFraudes,
        totalOtrosEstados,
        totalSinEstado,
        porcentajeFraude: porcentajeFraudeSobreRegistrados,
        conGeo,
        sinGeo,
        porcentajeGeo: porcentajeGeoGlobal,
        desgloseFraudes,
        desgloseEstados,
        rutaMayorIncidencia,
        calleMayorIncidencia,
      },
      porRuta: listaRutas,
      porCalle: listaCalles,
      topRutasFraude,
      topRutasTasa,
      rutasDisponibles,
      callesDisponibles,
      filtroActivo: {
        rutas: rutasFiltro,
        calles: callesFiltro,
        hayFiltroActivo,
      },
      actualizadoEl: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al calcular estadísticas:", error);
    return NextResponse.json(
      { error: "Error interno al calcular estadísticas." },
      { status: 500 }
    );
  }
}
