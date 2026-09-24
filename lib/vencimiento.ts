export interface InfoVencimiento {
  texto: string;
  subtexto?: string;
  estado: "vencida" | "vence_hoy" | "por_vencer" | "vigente" | "sin_fecha";
  dias: number | null;
  fechaFormateada: string;
}

export function obtenerInfoVencimiento(fechaVtoStr?: string | Date | null): InfoVencimiento {
  if (!fechaVtoStr) {
    return {
      texto: "—",
      estado: "sin_fecha",
      dias: null,
      fechaFormateada: "—",
    };
  }

  const vtoDate = new Date(fechaVtoStr);
  if (isNaN(vtoDate.getTime())) {
    return {
      texto: "—",
      estado: "sin_fecha",
      dias: null,
      fechaFormateada: "—",
    };
  }

  const dia = String(vtoDate.getUTCDate()).padStart(2, "0");
  const mes = String(vtoDate.getUTCMonth() + 1).padStart(2, "0");
  const anio = vtoDate.getUTCFullYear();
  const fechaFormateada = `${dia}/${mes}/${anio}`;

  const hoy = new Date();
  const hoyMidnight = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const vtoMidnight = Date.UTC(vtoDate.getUTCFullYear(), vtoDate.getUTCMonth(), vtoDate.getUTCDate());

  const msPorDia = 1000 * 60 * 60 * 24;
  const diasRestantes = Math.round((vtoMidnight - hoyMidnight) / msPorDia);

  if (diasRestantes < 0) {
    return {
      texto: `${fechaFormateada} (Vencida)`,
      subtexto: `Vencida hace ${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? "día" : "días"}`,
      estado: "vencida",
      dias: diasRestantes,
      fechaFormateada,
    };
  }

  if (diasRestantes === 0) {
    return {
      texto: `${fechaFormateada} (Vence hoy)`,
      subtexto: "Llegó la fecha límite",
      estado: "vence_hoy",
      dias: 0,
      fechaFormateada,
    };
  }

  if (diasRestantes === 1) {
    return {
      texto: `${fechaFormateada} (1 día restante)`,
      subtexto: "Último día disponible",
      estado: "por_vencer",
      dias: 1,
      fechaFormateada,
    };
  }

  if (diasRestantes <= 7) {
    return {
      texto: `${fechaFormateada} (${diasRestantes} días restantes)`,
      subtexto: "Próxima a vencer",
      estado: "por_vencer",
      dias: diasRestantes,
      fechaFormateada,
    };
  }

  return {
    texto: `${fechaFormateada} (${diasRestantes} días restantes)`,
    estado: "vigente",
    dias: diasRestantes,
    fechaFormateada,
  };
}
