/**
 * Utilidades para cálculo de distancias geográficas y generación de rutas óptimas
 * para operativos de corte de fraudes en Zárate.
 */

export interface UsuarioParaRuta {
  id: number;
  nroUsuario: string;
  nombre: string;
  domicilio: string | null;
  medidor: string | null;
  ruta: string | null;
  latitud: number | null;
  longitud: number | null;
  fechaVto?: string | Date | null;
  observaciones?: string | null;
  maps?: string | null;
  esDepartamento?: boolean;
  idEstadoDepto?: number | null;
  estadoDepto?: { id: number; nombre: string } | null;
  estado?: { id: number; nombre: string } | null;
  cuadrillas?: { id: number; nombre: string }[] | null;
  tarifa?: { id: number; nombre: string } | null;
}

export interface ParadaRuta {
  orden: number;
  usuario: UsuarioParaRuta;
  latitud: number;
  longitud: number;
  distanciaDesdeAnteriorMetros: number;
  distanciaAcumuladaMetros: number;
}

export interface ResultadoRuta {
  paradas: ParadaRuta[];
  distanciaTotalMetros: number;
  distanciaTotalFormateada: string;
  tiempoEstimadoMinutos: number;
  geometriaCalles?: [number, number][];
  esRutaPorCalles?: boolean;
}

/**
 * Fórmula de Haversine para calcular la distancia en metros entre dos coordenadas.
 */
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formato amigable de distancias (metros o kilómetros).
 */
export function formatearDistancia(metros: number): string {
  if (metros < 1000) {
    return `${metros} m`;
  }
  return `${(metros / 1000).toFixed(2)} km`;
}

/**
 * Calcula la ruta más conveniente de cortes usando la heurística del vecino más cercano (Nearest Neighbor).
 * Comienza en el usuario de inicio y recorre de forma óptima los N cortes más cercanos.
 */
export function calcularRutaOptimaCortes(
  usuarioInicio: UsuarioParaRuta,
  todosLosUsuarios: UsuarioParaRuta[],
  cantidadCortes: number
): ResultadoRuta | null {
  if (
    usuarioInicio.latitud === null ||
    usuarioInicio.longitud === null ||
    isNaN(Number(usuarioInicio.latitud)) ||
    isNaN(Number(usuarioInicio.longitud))
  ) {
    return null;
  }

  // Filtrar solo usuarios geolocalizados válidos
  const disponibles = todosLosUsuarios.filter(
    (u) =>
      u.latitud !== null &&
      u.longitud !== null &&
      !isNaN(Number(u.latitud)) &&
      !isNaN(Number(u.longitud))
  );

  if (disponibles.length === 0) return null;

  // Ajustar cantidad solicitada al máximo disponible
  const cantidadReal = Math.min(Math.max(1, cantidadCortes), disponibles.length);

  // Pool de usuarios no visitados aún (excluyendo el inicial)
  const noVisitados = disponibles.filter((u) => u.id !== usuarioInicio.id);

  const paradas: ParadaRuta[] = [];
  let actualLat = Number(usuarioInicio.latitud);
  let actualLng = Number(usuarioInicio.longitud);
  let acumulado = 0;

  // Primera parada: el usuario de inicio seleccionado
  paradas.push({
    orden: 1,
    usuario: usuarioInicio,
    latitud: actualLat,
    longitud: actualLng,
    distanciaDesdeAnteriorMetros: 0,
    distanciaAcumuladaMetros: 0,
  });

  // Elegir secuencialmente el siguiente corte más cercano
  while (paradas.length < cantidadReal && noVisitados.length > 0) {
    let indiceMejor = -1;
    let menorDistancia = Infinity;

    for (let i = 0; i < noVisitados.length; i++) {
      const u = noVisitados[i];
      const d = calcularDistanciaMetros(
        actualLat,
        actualLng,
        Number(u.latitud),
        Number(u.longitud)
      );

      if (d < menorDistancia) {
        menorDistancia = d;
        indiceMejor = i;
      }
    }

    if (indiceMejor === -1) break;

    const [siguiente] = noVisitados.splice(indiceMejor, 1);
    const sigLat = Number(siguiente.latitud);
    const sigLng = Number(siguiente.longitud);

    acumulado += menorDistancia;

    paradas.push({
      orden: paradas.length + 1,
      usuario: siguiente,
      latitud: sigLat,
      longitud: sigLng,
      distanciaDesdeAnteriorMetros: menorDistancia,
      distanciaAcumuladaMetros: acumulado,
    });

    actualLat = sigLat;
    actualLng = sigLng;
  }

  // Estimación de tiempo: 30 km/h velocidad promedio en ciudad + 15 min de maniobra por corte
  const tiempoViajeMinutos = (acumulado / 1000 / 30) * 60;
  const tiempoManiobrasMinutos = paradas.length * 15;
  const tiempoTotalMinutos = Math.round(tiempoViajeMinutos + tiempoManiobrasMinutos);

  return {
    paradas,
    distanciaTotalMetros: acumulado,
    distanciaTotalFormateada: formatearDistancia(acumulado),
    tiempoEstimadoMinutos: tiempoTotalMinutos,
  };
}

/**
 * Construye una ruta a partir de una lista secuencial de usuarios seleccionados manualmente uno a uno.
 */
export function construirRutaManual(
  usuariosSeleccionados: UsuarioParaRuta[]
): ResultadoRuta | null {
  if (usuariosSeleccionados.length === 0) return null;

  const paradas: ParadaRuta[] = [];
  let acumulado = 0;

  for (let i = 0; i < usuariosSeleccionados.length; i++) {
    const u = usuariosSeleccionados[i];
    const lat = Number(u.latitud);
    const lng = Number(u.longitud);

    let distAnterior = 0;
    if (i > 0) {
      const prev = usuariosSeleccionados[i - 1];
      distAnterior = calcularDistanciaMetros(
        Number(prev.latitud),
        Number(prev.longitud),
        lat,
        lng
      );
      acumulado += distAnterior;
    }

    paradas.push({
      orden: i + 1,
      usuario: u,
      latitud: lat,
      longitud: lng,
      distanciaDesdeAnteriorMetros: distAnterior,
      distanciaAcumuladaMetros: acumulado,
    });
  }

  const tiempoViajeMinutos = (acumulado / 1000 / 30) * 60;
  const tiempoManiobrasMinutos = paradas.length * 15;
  const tiempoTotalMinutos = Math.round(tiempoViajeMinutos + tiempoManiobrasMinutos);

  return {
    paradas,
    distanciaTotalMetros: acumulado,
    distanciaTotalFormateada: formatearDistancia(acumulado),
    tiempoEstimadoMinutos: tiempoTotalMinutos,
  };
}

/**
 * Genera la URL de Google Maps Navigation con waypoints ordenados para la cuadrilla.
 */
export function generarUrlGoogleMapsRuta(paradas: ParadaRuta[]): string {
  if (paradas.length === 0) return "";
  if (paradas.length === 1) {
    return `https://www.google.com/maps?q=${paradas[0].latitud},${paradas[0].longitud}`;
  }

  const origen = `${paradas[0].latitud},${paradas[0].longitud}`;
  const destino = `${paradas[paradas.length - 1].latitud},${paradas[paradas.length - 1].longitud}`;

  if (paradas.length === 2) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving`;
  }

  // Google Maps acepta hasta 9 waypoints en URL directa estándar
  const waypoints = paradas
    .slice(1, paradas.length - 1)
    .slice(0, 8)
    .map((p) => `${p.latitud},${p.longitud}`)
    .join("|");

  return `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&waypoints=${waypoints}&travelmode=driving`;
}

export interface DatosRutaCalles {
  distanciaTotalMetros: number;
  duracionTotalSegundos: number;
  geometriaCalles: [number, number][];
  legs: { distanciaMetros: number; duracionSegundos: number }[];
  waypoints?: { lat: number; lng: number; name: string; distanceToRoadMeters: number }[];
}

/**
 * Consulta la API de ruteo para obtener el trazado exacto por calles y distancias reales de conducción.
 */
export async function obtenerRutaPorCalles(
  paradas: ParadaRuta[]
): Promise<DatosRutaCalles | null> {
  if (paradas.length < 2) return null;

  try {
    const coordinates = paradas.map((p) => ({
      lat: p.latitud,
      lng: p.longitud,
    }));

    const res = await fetch("/api/routing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates }),
    });

    if (!res.ok) {
      console.warn("No se pudo obtener el trazado por calles:", res.statusText);
      return null;
    }

    const data = await res.json();
    if (!data.ok) return null;

    return data as DatosRutaCalles;
  } catch (err) {
    console.error("Error al consultar ruta por calles:", err);
    return null;
  }
}

/**
 * Aplica los datos de navegación por calles al ResultadoRuta, recalculando distancias reales
 * tramo por tramo y asignando la geometría de curvas de las calles.
 */
export function aplicarRutaPorCalles(
  resultadoBase: ResultadoRuta,
  datosCalles: DatosRutaCalles
): ResultadoRuta {
  let acumulado = 0;

  const paradasActualizadas = resultadoBase.paradas.map((p, idx) => {
    if (idx === 0) {
      return {
        ...p,
        distanciaDesdeAnteriorMetros: 0,
        distanciaAcumuladaMetros: 0,
      };
    }

    const leg = datosCalles.legs && datosCalles.legs[idx - 1];
    const distLeg = leg ? leg.distanciaMetros : p.distanciaDesdeAnteriorMetros;
    acumulado += distLeg;

    return {
      ...p,
      distanciaDesdeAnteriorMetros: distLeg,
      distanciaAcumuladaMetros: acumulado,
    };
  });

  const distanciaTotal = datosCalles.distanciaTotalMetros || acumulado;
  const tiempoViajeMinutos = Math.round((datosCalles.duracionTotalSegundos || 0) / 60);
  const tiempoManiobrasMinutos = paradasActualizadas.length * 15;
  const tiempoTotalMinutos = Math.max(15, tiempoViajeMinutos + tiempoManiobrasMinutos);

  return {
    ...resultadoBase,
    paradas: paradasActualizadas,
    distanciaTotalMetros: distanciaTotal,
    distanciaTotalFormateada: formatearDistancia(distanciaTotal),
    tiempoEstimadoMinutos: tiempoTotalMinutos,
    geometriaCalles: datosCalles.geometriaCalles,
    esRutaPorCalles: true,
  };
}

