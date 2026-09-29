import { prisma } from "../lib/prisma";

export function normalizarDomicilio(domOriginal: string): { nuevo: string; cambio: boolean } {
  if (!domOriginal) return { nuevo: domOriginal, cambio: false };
  let dom = domOriginal.trim();
  const inicio = dom;

  // Fix character encoding issues (# and ﾑ -> Ñ)
  dom = dom.replace(/ﾑ/g, "Ñ").replace(/#/g, "Ñ").replace(/･/g, "Ñ");

  // 1. E.SMITHFIELD = 347 POR Estancia Smithfield
  dom = dom.replace(/\bE\.?\s*SMITHFIELD\b/gi, "Estancia Smithfield");

  // 2. HIPOLITO YRIGOYEN = 289 POR Hipólito Yrigoyen (incluyendo variaciones de tipeo como Yrigogen, Yryigoyen, etc.)
  dom = dom.replace(
    /\b(?:H\.?\s*[YI]R[A-Z]{3,8}N|HIP[OÓ]LITO\s+[A-Z]*[YI]R[A-Z]+N)\b/gi,
    "Hipólito Yrigoyen"
  );

  // 3. BERUTTI = 193 por Beruti
  dom = dom.replace(/\bBERUTTI\b/gi, "Beruti");

  // 4. J.J. PASO = 143 POR JUAN JOSÉ PASO
  dom = dom.replace(/\b(?:J\.?\s*J\.?\s*PAS+O|PASSO)\b/gi, "JUAN JOSÉ PASO");

  // 5. ROMULO NOYA = 118 R.NOYA POR ROMULO NOYA
  dom = dom.replace(/\bR\.?\s*NOYA\b/gi, "ROMULO NOYA");

  // 6. ALTOS DEL CASCO = 111 A. DEL CASCO POR ALTOS DEL CASCO
  dom = dom.replace(/\bA\.?\s*DEL\s*CASCO\b/gi, "ALTOS DEL CASCO");

  // 7. L. MIRTILLOS II = 105 POR LOS MIRTILLOS II
  dom = dom.replace(/\bL\.?\s*MIRTILLOS(?:\s*II)?\b/gi, "LOS MIRTILLOS II");

  // 8. ARRIBEÑOS = 99 CASO PARTICULAS LA CALLE ESTA BIEN PERO LA MAYORIA DE LOS NUMEROS ESTAN SEPARADOS JUNTALOS, EJEMPLO: 4 5 6
  if (/\bAR+IBE[ÑN]OS\b/i.test(dom)) {
    dom = dom.replace(/\bAR+IBE[ÑN]OS\b/gi, "Arribeños");
    // Look for separated digits: "4 5 6" -> "456", "4 1 4" -> "414"
    dom = dom.replace(/\b(\d)\s+(\d)\s+(\d)\b/g, "$1$2$3");
    dom = dom.replace(/\b(\d)\s+(\d)\b/g, "$1$2");
  }

  // 9. FINCAS DE LA FLORIDA = 86
  dom = dom.replace(/\bF\.?\s*DE\s*LA\s*FLORIDA\b/gi, "FINCAS DE LA FLORIDA");

  // 10. ESPAÑA = 75
  dom = dom.replace(/\bESPA[ÑN]A\b/gi, "España");

  // 11. B.Nombre -> Barrio Nombre
  const barriosB = [
    "COVEPAN",
    "FONAVI",
    "VIPERMUN",
    "VIP",
    "ESCALADA",
    "VICTORIA",
    "VIZA",
    "DON MARCOS",
    "MATADERO",
    "PLAN FEDERAL",
    "PLAN FED",
    "SAAVEDRA",
    "FERROVIARIO",
    "VOLUNTARIOS",
    "SAN JORGE",
    "SAN MIGUEL",
    "METEOR",
    "EL NOGAL",
    "LAS LOMAS",
    "LAS PICADAS",
    "LA FLORIDA",
    "BAYER",
    "UNION Y FE",
    "UNION Y FUERZA",
    "ANTARTIDA",
    "COOP",
    "SOLIDARI",
    "QUEBRADA",
    "NARANJOS",
    "ALBERTO",
  ];
  for (const b of barriosB) {
    const reg = new RegExp(`\\bB\\.?\\s*(${b}\\b)`, "i");
    if (reg.test(dom)) {
      dom = dom.replace(reg, "Barrio $1");
      break;
    }
  }

  // 12. A.Nombre -> Avenida Nombre
  // A.ANTA / A.ARGENTINA -> Avenida Antártida Argentina
  dom = dom.replace(
    /\bA\.?\s*(?:ANTA|ARGENTINA|ARG)\b/gi,
    "Avenida Antártida Argentina"
  );
  // A.GALLESIO -> Avenida Gallesio
  dom = dom.replace(/\bA\.?\s*GALLESIO\b/gi, "Avenida Gallesio");
  // A.DEL VALLE -> Aristóbulo del Valle
  dom = dom.replace(/\bA\.?\s*DEL\s*VALLE\b/gi, "Aristóbulo del Valle");
  // A.BROWN -> Almirante Brown
  dom = dom.replace(/\bA\.?\s*BROWN\b/gi, "Almirante Brown");

  // Cleanup extra spaces
  dom = dom.replace(/\s+/g, " ").trim();

  return { nuevo: dom, cambio: dom !== inicio };
}

async function main() {
  console.log("=======================================================");
  console.log("📝 ACTUALIZACIÓN DE DOMICILIOS EN BASE DE DATOS");
  console.log("=======================================================\n");

  const usuarios = await prisma.usuario.findMany({
    select: { id: true, nroUsuario: true, domicilio: true },
  });

  let modificados = 0;
  const updates: { id: number; nuevo: string }[] = [];

  for (const u of usuarios) {
    if (!u.domicilio) continue;
    const { nuevo, cambio } = normalizarDomicilio(u.domicilio);
    if (cambio) {
      updates.push({ id: u.id, nuevo });
      modificados++;
    }
  }

  console.log(`📊 Total usuarios evaluados: ${usuarios.length.toLocaleString()}`);
  console.log(`🔄 Usuarios con domicilios a actualizar: ${modificados.toLocaleString()}\n`);

  if (updates.length === 0) {
    console.log("✅ No hay domicilios pendientes de actualización.");
    return;
  }

  // Ejecutar actualizaciones en lotes (batch)
  const batchSize = 100;
  console.log(`🚀 Guardando cambios en base de datos en lotes de ${batchSize}...`);

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.usuario.update({
          where: { id: item.id },
          data: { domicilio: item.nuevo },
        })
      )
    );
    process.stdout.write(
      `\rProgreso: ${Math.min(i + batchSize, updates.length)} / ${updates.length} actualizados`
    );
  }

  console.log("\n\n✅ ¡Todos los domicilios fueron actualizados con éxito!");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Error actualizando domicilios:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
