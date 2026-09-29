async function probar(q: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Zarate, Buenos Aires, Argentina")}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TestZarate/1.0", "Accept-Language": "es" }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      console.log(`✅ "${q}" -> ENCONTRADO (${data[0].display_name.slice(0, 50)}...)`);
    } else {
      console.log(`❌ "${q}" -> NO ENCONTRADO`);
    }
  } catch (e: any) {
    console.log(`⚠️ "${q}" -> ERROR: ${e.message}`);
  }
}

async function run() {
  await probar("Berutti");
  await probar("Beruti");
  await probar("Arribeños");
  await probar("España");
  await probar("Saenz Peña");
  await probar("Sargento Cabral");
  await probar("SGTO.CABRAL");
  await probar("Paso");
  await probar("Justa Lima");
  await probar("J.Lima");
  await probar("Yrigoyen");
  await probar("Hipolito Yrigoyen");
}

run();
