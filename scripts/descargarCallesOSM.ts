import fs from "fs";
import path from "path";

async function main() {
  const OUT_FILE = path.join(process.cwd(), "migracion", "calles_geometria_osm.json");
  
  // Bounding box for Zárate and Lima
  // Zárate center: -34.10, -59.03
  // Lima center: -34.04, -59.20
  console.log("📡 Descargando geometría de todas las calles de Zárate y Lima desde Overpass...");

  const query = `[out:json][timeout:90];
  (
    way["highway"~"primary|secondary|tertiary|residential|unclassified|living_street"]["name"](-34.18,-59.15,-34.05,-58.97);
    way["highway"~"primary|secondary|tertiary|residential|unclassified|living_street"]["name"](-34.08,-59.25,-34.00,-59.15);
  );
  out geom;`;

  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let rawData = null;
  for (const mirror of mirrors) {
    try {
      console.log(`Intentando con ${mirror}...`);
      const res = await fetch(mirror, {
        method: "POST",
        body: query,
        headers: { "User-Agent": "SistemaFraudeGeometria/1.0" },
      });
      if (res.ok) {
        rawData = await res.json();
        console.log(`✅ ¡Éxito! Elementos descargados: ${rawData.elements?.length}`);
        break;
      } else {
        console.warn(`Respuesta no OK (${res.status}) de ${mirror}`);
      }
    } catch (e: any) {
      console.warn(`Error conectando a ${mirror}:`, e.message);
    }
  }

  if (!rawData || !rawData.elements) {
    console.error("❌ No se pudo descargar datos de ningún mirror de Overpass");
    return;
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(rawData, null, 2), "utf-8");
  console.log(`📁 Geometría guardada en: ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2)} MB)`);
}

main().catch(console.error);
