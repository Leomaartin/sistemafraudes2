import { prisma } from "../lib/prisma";
import * as XLSX from "xlsx";
import path from "path";

const LISTA_NOMBRES = [
  "FORESTAL RINCON T4NR",
  "MONTE GORBEA S.A. T4NR",
  "Jayme Angelica T4R",
  "MONTIEL ALVAREZ DELMO",
  "CLUB DE NIÑOS S.JOSE DE",
  "Bas Cesar Antonio M",
  "RODRIGUEZ MARIA I",
  "IREMIR SOC.RES.LIMIT",
  "IREMIR SOC.RESP.LI",
  "GARCIA BEATRIZ EDITH",
  "Duarte Leticia",
  "Vignati Amalia",
  "PEREYRA LEANDRO EZEQUIEL",
  "LOSCO ANDREA",
  "Civial SA",
  "RONDAN SILVIA ESTHER",
  "A.P.A.D.ASOCIADOS",
  "MINISTERIO CNO.DE SALVAC",
  "PONCE GLADYS ESTER",
  "FERRARI ANA LUCIA",
  "FARIAS CAROLINA SOLEDAD",
  "MORENA CLAUDIA MARCELA",
  "VERA ANIBAL MARCELO",
  "SUAREZ PORTILLO LEONEL",
  "ROTONDO MAURICIO ESTEBAN",
  "TAFFAREL MARIA GUADALUPE",
  "MOLINA ILDA PATRICIA",
  "HUAYHUARIMA CARMEN ROSA",
  "MARTINEZ MARTIN OS",
  "GOMEZ LUJAN ELIZABETH",
  "CARDOZO ZAMBRANA V",
  "GALIANO NANCY PATRICIA",
  "COLAZO MARIA DELIA",
  "FARIAS CAROLINA SOLEDAD",
  "VALLE MATIAS SEBASTIAN",
  "Pereyra Leandro Ezequiel",
  "Witt jorge omar",
  "PEREYRA LORENA PAOLA",
  "Milu y agustin",
  "FERNANDEZ MIRTA ISABEL",
  "GOMEZ PAOLO",
  "ALVAREZ MAXIMILIANO MART",
  "GUTIERREZ SABRINA VANESA",
  "IREMIR S.R.L"
];

function normalizar(texto: string): string {
  return texto
    .replace(/\s+T\d+[A-Z0-9\-]*\b/gi, "") // Quitar sufijos de tarifa como T4NR, T4R
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
    .replace(/[^A-Za-z0-9\s]/g, " ") // Puntuación a espacios
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

async function main() {
  const allUsers = await prisma.usuario.findMany({
    select: {
      id: true,
      nroUsuario: true,
      nombre: true,
      estado: { select: { nombre: true } },
      tarifa: { select: { nombre: true } },
    }
  });

  // Filtrar solo usuarios con nombre válido
  const validUsers = allUsers.filter(u => u.nombre && u.nombre.trim().length > 1);

  const filasFinales: { "N° USUARIO": string; "NOMBRE": string; "TARIFA": string; "ESTADO": string }[] = [];
  const encontradosSet = new Set<string>();

  for (let i = 0; i < LISTA_NOMBRES.length; i++) {
    const raw = LISTA_NOMBRES[i];
    const norm = normalizar(raw);

    // 1. Coincidencia exacta de nombre normalizado
    let match = validUsers.find(u => normalizar(u.nombre) === norm);

    // 2. Si no, coincidencia por startsWith o contains completo
    if (!match) {
      match = validUsers.find(u => {
        const uNorm = normalizar(u.nombre);
        return uNorm.startsWith(norm) || norm.startsWith(uNorm);
      });
    }

    // 3. Si no, que todas las palabras clave estén incluidas
    if (!match) {
      const words = norm.split(" ").filter(w => w.length >= 3);
      if (words.length > 0) {
        const candidates = validUsers.filter(u => {
          const uNorm = normalizar(u.nombre);
          return words.every(w => uNorm.includes(w));
        });
        if (candidates.length > 0) {
          // Preferir uno que no hayamos usado aún si hay múltiples con el mismo nombre
          const unused = candidates.find(c => !encontradosSet.has(c.nroUsuario));
          match = unused || candidates[0];
        }
      }
    }

    if (match) {
      encontradosSet.add(match.nroUsuario);
      filasFinales.push({
        "N° USUARIO": match.nroUsuario,
        "NOMBRE": match.nombre.trim(),
        "TARIFA": match.tarifa?.nombre || "SIN TARIFA",
        "ESTADO": match.estado?.nombre || "SIN ESTADO"
      });
      console.log(`[${i + 1}/${LISTA_NOMBRES.length}] ✅ "${raw}" -> #${match.nroUsuario} | ${match.nombre} | ${match.tarifa?.nombre || "-"} | ${match.estado?.nombre || "SIN ESTADO"}`);
    } else {
      console.log(`[${i + 1}/${LISTA_NOMBRES.length}] ❌ "${raw}" -> No encontrado`);
      filasFinales.push({
        "N° USUARIO": "-",
        "NOMBRE": raw,
        "TARIFA": "-",
        "ESTADO": "NO ENCONTRADO"
      });
    }
  }

  // Generar Excel con columnas: N° USUARIO, NOMBRE, TARIFA, ESTADO
  const worksheet = XLSX.utils.json_to_sheet(filasFinales);

  worksheet["!cols"] = [
    { wch: 18 }, // N° USUARIO
    { wch: 38 }, // NOMBRE
    { wch: 18 }, // TARIFA
    { wch: 25 }, // ESTADO
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Usuarios");

  const rutaSalida = path.join(process.cwd(), "informe_usuarios_solicitados.xlsx");
  XLSX.writeFile(workbook, rutaSalida);

  console.log(`\n=================================================`);
  console.log(`📄 Archivo Excel generado: ${rutaSalida}`);
  console.log(`=================================================`);
}

main().catch(console.error).finally(() => process.exit(0));
