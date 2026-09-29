import { prisma } from "../lib/prisma";
import fs from "fs";

async function detailedAnalysis() {
  const officialEstados = await prisma.estado.findMany();
  console.log("=== ESTADOS OFICIALES EN BASE DE DATOS ===");
  for (const e of officialEstados) {
    console.log(`ID: ${e.id} | Nombre: ${e.nombre}`);
  }

  const users = await prisma.usuario.findMany({
    where: { idEstado: null },
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      domicilio: true,
      ruta: true,
      observaciones: true,
      esDepartamento: true,
    },
  });

  const total = users.length;
  console.log(`Total usuarios sin estado asignado: ${total}`);

  // Normalizador y clasificador jerárquico
  // Para asignar a cada usuario su estado inferido más representativo
  function clasificarEstado(rawObs: string | null): {
    estadoInferido: string;
    subcategoria: string;
    esFraude: boolean;
  } {
    if (!rawObs || !rawObs.trim()) {
      return {
        estadoInferido: "(SIN OBSERVACIONES / SIN DATOS)",
        subcategoria: "Sin texto en observaciones",
        esFraude: false,
      };
    }

    const obs = rawObs.toUpperCase();

    // 1. Detección de "SIN FRAUDE" (incluye variantes y abreviaturas como S/F, sin frade, revisado ok, todo ok)
    const sinFraudeRegex = /(?:SIN|NO|NO\s+HAY|REVISADO\s+SIN)\s+FR?AU?DE|\bS\/F\b|REVISADO\s+OK|TODO\s+OK/i;
    const tieneSinFraude = sinFraudeRegex.test(obs);
    
    // Para fraude positivo, removemos temporalmente las frases "SIN FRAUDE" para no dar falso positivo
    const obsSinNegacion = obs.replace(sinFraudeRegex, "");
    const tieneFraude = /\bFRAUDE\b/i.test(obsSinNegacion) || /ENGANCHE|CLANDESTINO|DIRECTO\s+SIN\s+MEDIDOR|ACTA\s+\d+|L[IÍ]NEA\s+PARALELA/i.test(obsSinNegacion);

    if (tieneSinFraude && !tieneFraude) {
      return {
        estadoInferido: "SIN FRAUDE / REVISADO REGULAR",
        subcategoria: "Inspeccionado sin fraude",
        esFraude: false,
      };
    }

    // Si tiene FRAUDE y también CORTE
    if (/CORTE.*FRAUDE|FRAUDE.*CORTE/i.test(obsSinNegacion)) {
      return {
        estadoInferido: "CORTE Y FRAUDE",
        subcategoria: "Corte y Fraude",
        esFraude: true,
      };
    }

    // Si dice "PARA CORTE" o "CORTE" o "CORTAR"
    if (/\b(?:PARA\s+CORTE|CORTADO|CORTE|CORTAR)\b/i.test(obs) && !tieneFraude) {
      return {
        estadoInferido: "CORTE",
        subcategoria: "Corte / Para corte",
        esFraude: false,
      };
    }

    // Si tiene FRAUDE pero después se regularizó (PAGO TOTAL / CANCELO)
    if (tieneFraude && /PAGO\s+(?:EL\s+)?TOTAL|CANCEL[OÓ]\s+DEUDA/i.test(obs)) {
      return {
        estadoInferido: "FRAUDE - PAGO TOTAL / REGULARIZADO",
        subcategoria: "Fraude con deuda cancelada",
        esFraude: true,
      };
    }

    // Si tiene FRAUDE y SUSPENDIDO
    if (tieneFraude && /U?SUSPEND(?:ER|ID[OA]|I[DO])|\bSUSP\b/i.test(obs)) {
      return {
        estadoInferido: "FRAUDE / SUSPENDIDO",
        subcategoria: "Fraude suspendido",
        esFraude: true,
      };
    }

    // Si tiene FRAUDE y NOTIFICADO
    if (tieneFraude && /NOTIFIC(?:AR|AD[OA]|ACI[OÓ]N|ACIONES?)|\bNOTF\b/i.test(obs)) {
      return {
        estadoInferido: "FRAUDE / NOTIFICADO",
        subcategoria: "Fraude notificado",
        esFraude: true,
      };
    }

    // Si tiene FRAUDE puro o con acta
    if (tieneFraude) {
      if (/ACTA\s+\d+/i.test(obs)) {
        return {
          estadoInferido: "FRAUDE CON ACTA",
          subcategoria: "Fraude con número de acta",
          esFraude: true,
        };
      }
      if (/ENGANCHE|DIRECTO|L[IÍ]NEA\s+PARALELA/i.test(obs)) {
        return {
          estadoInferido: "FRAUDE - CONEXIÓN DIRECTA / ENGANCHE",
          subcategoria: "Conexión clandestina o directa",
          esFraude: true,
        };
      }
      return {
        estadoInferido: "FRAUDE",
        subcategoria: "Fraude general",
        esFraude: true,
      };
    }

    // SUSPENDIDO (sin fraude)
    if (/U?SUSPEND(?:ER|ID[OA]|I[DO])|\bSUSP\b/i.test(obs)) {
      if (/PAGO\s+(?:EL\s+)?TOTAL/i.test(obs)) {
        return {
          estadoInferido: "SUSPENDIDO - PAGO TOTAL",
          subcategoria: "Suspendido regularizado",
          esFraude: false,
        };
      }
      return {
        estadoInferido: "SUSPENDIDO",
        subcategoria: "Suspendido general",
        esFraude: false,
      };
    }

    // NOTIFICADO (sin fraude)
    if (/NOTIFIC(?:AR|AD[OA]|ACI[OÓ]N|ACIONES?)|\bNOTF\b/i.test(obs)) {
      return {
        estadoInferido: "NOTIFICADO",
        subcategoria: "Notificado al domicilio",
        esFraude: false,
      };
    }

    // TIEMPO (le dieron tiempo)
    if (/\b(?:LE\s+DIERON\s+)?TIEMPO\b/i.test(obs)) {
      return {
        estadoInferido: "TIEMPO",
        subcategoria: "Prórroga / Tiempo concedido",
        esFraude: false,
      };
    }

    // RECONECTADO
    if (/RECONECTAD[OA]|RECONEXI[OÓ]N/i.test(obs)) {
      return {
        estadoInferido: "RECONECTADO",
        subcategoria: "Reconectado",
        esFraude: false,
      };
    }

    // RETIRADO (medidor retirado / para retiro)
    if (/RETIR(?:AR|AD[OA]|O)|MEDIDOR\s+RETIRADO/i.test(obs)) {
      return {
        estadoInferido: "RETIRADO",
        subcategoria: "Medidor retirado / para retiro",
        esFraude: false,
      };
    }

    // BAJA
    if (/\bBAJA\b|DADO\s+DE\s+BAJA/i.test(obs)) {
      return {
        estadoInferido: "BAJA",
        subcategoria: "Baja de suministro",
        esFraude: false,
      };
    }

    // NO CORTAR / GERENCIA
    if (/NO\s+CORTAR|\bGERENCIA\b/i.test(obs)) {
      return {
        estadoInferido: "NO CORTAR / GERENCIA",
        subcategoria: "Instrucción de no cortar / gerencia",
        esFraude: false,
      };
    }

    // PAGOS A CUENTA / PARCIAL
    if (/PAGOS?\s+A\s+CUENTA|PAGO\s+PARCIAL/i.test(obs)) {
      return {
        estadoInferido: "PAGOS A CUENTA",
        subcategoria: "Pagos a cuenta",
        esFraude: false,
      };
    }

    // PAGO TOTAL (sin otro estado)
    if (/PAGO\s+(?:EL\s+)?TOTAL|CANCEL[OÓ]/i.test(obs)) {
      return {
        estadoInferido: "PAGO TOTAL / REGULARIZADO",
        subcategoria: "Pago total sin fraude",
        esFraude: false,
      };
    }

    // SIN MEDIDOR / NO ENCONTRADO
    if (/N*NO\s+ENCO?NTR[A-Z]*\s+MEDIDOR|SIN\s+MEDIDOR|NO\s+SE\s+ENCONTR[OÓ]/i.test(obs)) {
      return {
        estadoInferido: "SIN MEDIDOR / NO ENCONTRADO",
        subcategoria: "Inspección sin medidor hallado",
        esFraude: false,
      };
    }

    // CAMBIO DE TITULARIDAD
    if (/CAMBIO\s+DE\s+TITULARIDAD|TITULAR/i.test(obs)) {
      return {
        estadoInferido: "CAMBIO DE TITULARIDAD",
        subcategoria: "Trámite administrativo",
        esFraude: false,
      };
    }

    // Si tiene "SIN FRAUDE" mezclado con algún texto no clasificado antes
    if (tieneSinFraude) {
      return {
        estadoInferido: "SIN FRAUDE / REVISADO REGULAR",
        subcategoria: "Revisado sin fraude",
        esFraude: false,
      };
    }

    // Otras observaciones técnicas diversas
    return {
      estadoInferido: "OTRAS NOTAS TÉCNICAS",
      subcategoria: "Observaciones varias no estandarizadas",
      esFraude: false,
    };
  }

  const agrupado: Record<string, { count: number; esFraude: boolean; samples: string[] }> = {};

  for (const u of users) {
    const res = clasificarEstado(u.observaciones);
    const key = res.estadoInferido;
    if (!agrupado[key]) {
      agrupado[key] = { count: 0, esFraude: res.esFraude, samples: [] };
    }
    agrupado[key].count++;
    if (agrupado[key].samples.length < 5) {
      agrupado[key].samples.push(u.observaciones || "");
    }
  }

  // Ordenar de mayor a menor
  const sorted = Object.entries(agrupado).sort((a, b) => b[1].count - a[1].count);

  console.log("\n=======================================================");
  console.log("📊 RESULTADO DE CLASIFICACIÓN EXCLUSIVA DE ESTADOS");
  console.log("=======================================================");
  let checkSum = 0;
  for (const [est, info] of sorted) {
    checkSum += info.count;
    const pct = ((info.count / total) * 100).toFixed(2);
    console.log(`${est} = ${info.count} (${pct}%)`);
  }
  console.log(`\nSuma total verificada: ${checkSum} / ${total}`);

  // Ver muestras de OTRAS NOTAS TÉCNICAS
  const todasOtras = users.filter(u => agrupado["OTRAS NOTAS TÉCNICAS"]?.samples.includes(u.observaciones || ""));
  console.log("\n--- 25 MUESTRAS DIVERSAS DE 'OTRAS NOTAS TÉCNICAS' ---");
  const todasNotas = users.filter(u => {
    const res = clasificarEstado(u.observaciones);
    return res.estadoInferido === "OTRAS NOTAS TÉCNICAS";
  });
  for (let i = 0; i < Math.min(25, todasNotas.length); i++) {
    console.log(`${i + 1}. "${todasNotas[i].observaciones}"`);
  }

  // Guardar archivo JSON estructurado
  const informeJson = {
    totalSinEstado: total,
    distribucion: sorted.map(([estado, data]) => ({
      estado,
      cantidad: data.count,
      porcentaje: ((data.count / total) * 100).toFixed(2) + "%",
      esFraude: data.esFraude,
      ejemplos: data.samples,
    })),
  };

  fs.writeFileSync(
    "scripts/conteo_estados_sin_asignar.json",
    JSON.stringify(informeJson, null, 2),
    "utf-8"
  );
  console.log("\n✅ Guardado informe completo en scripts/conteo_estados_sin_asignar.json");

  await prisma.$disconnect();
}

detailedAnalysis();
