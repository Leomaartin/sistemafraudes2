import { NextRequest, NextResponse } from "next/server";

interface Coordinate {
  lat: number;
  lng: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const coordinates: Coordinate[] = body.coordinates;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: "Se requieren al menos 2 coordenadas para calcular el recorrido por calles." },
        { status: 400 }
      );
    }

    // OSRM espera formato "longitud,latitud;longitud,latitud;..."
    const coordsStr = coordinates
      .map((c) => `${Number(c.lng).toFixed(6)},${Number(c.lat).toFixed(6)}`)
      .join(";");

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false&annotations=distance`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SistemaFraudeZarate/1.0",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Error del servidor de ruteo: ${res.statusText}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { error: data.message || "No se pudo trazar una ruta vial entre los puntos indicados." },
        { status: 404 }
      );
    }

    const primaryRoute = data.routes[0];
    const totalDistanceMeters = Math.round(primaryRoute.distance);
    const totalDurationSeconds = Math.round(primaryRoute.duration);

    // GeoJSON coordinates en OSRM son [lon, lat]. Convertimos a [lat, lon] para Leaflet
    const streetGeometry: [number, number][] = (
      primaryRoute.geometry?.coordinates || []
    ).map(([lon, lat]: [number, number]) => [lat, lon]);

    // Información tramo a tramo (legs)
    const legs = (primaryRoute.legs || []).map((leg: any) => ({
      distanciaMetros: Math.round(leg.distance || 0),
      duracionSegundos: Math.round(leg.duration || 0),
    }));

    // Ubicaciones aproximadas a la calle más cercana (snapping)
    const snappedWaypoints = (data.waypoints || []).map((wp: any) => ({
      lat: wp.location[1],
      lng: wp.location[0],
      name: wp.name || "",
      distanceToRoadMeters: Math.round(wp.distance || 0),
    }));

    return NextResponse.json({
      ok: true,
      distanciaTotalMetros: totalDistanceMeters,
      duracionTotalSegundos: totalDurationSeconds,
      geometriaCalles: streetGeometry,
      legs,
      waypoints: snappedWaypoints,
    });
  } catch (error: any) {
    if (error.name === "AbortError") {
      return NextResponse.json(
        { error: "Tiempo de espera agotado al consultar el trazado por calles." },
        { status: 504 }
      );
    }
    console.error("Error en API de ruteo por calles:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al calcular el recorrido por calles." },
      { status: 500 }
    );
  }
}
