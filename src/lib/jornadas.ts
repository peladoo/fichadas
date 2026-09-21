import {
  supabase,
  type Fichada,
  type FichadaExtra,
  type TipoFichada,
  type TipoJornada,
} from "@/lib/supabase";

export const VENTANA_NORMAL_ABIERTA_HORAS = 24;
export const LIMITE_JORNADA_NORMAL_HORAS = 7;
export const LIMITE_FICHADA_EXTRA_HORAS = 6;
export const UMBRAL_REVISAR_EXTRA_HORAS = 12;

export type EstadoEmpleadoTipo = "libre" | "normal_abierta" | "extra_abierta";

export interface EstadoEmpleado {
  estado: EstadoEmpleadoTipo;
  desde?: string;
  extraAbierta?: FichadaExtra;
}

export interface ValidacionAccion {
  ok: boolean;
  alerta?: string;
}

export interface Jornada {
  documento: string;
  entrada: Fichada;
  salida?: Fichada;
  horas: number | null;
  incompleta: boolean;
  excedeLimite: boolean;
}

export interface ExtraEvaluada {
  horas: number;
  abierta: boolean;
  excedeLimite: boolean;
  requiereRevision: boolean;
}

const horasEntre = (desde: string, hasta: string): number => {
  const ms = new Date(hasta).getTime() - new Date(desde).getTime();
  return ms / (1000 * 60 * 60);
};

const esMismoDiaLocal = (a: string, b: Date = new Date()): boolean => {
  const da = new Date(a);
  return (
    da.getFullYear() === b.getFullYear() &&
    da.getMonth() === b.getMonth() &&
    da.getDate() === b.getDate()
  );
};

const formatHoraCorta = (iso: string): string => {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatFechaCorta = (iso: string): string => {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const formatHoras = (decimal: number | null | undefined): string => {
  if (decimal == null || Number.isNaN(decimal) || decimal < 0) return "—";
  const totalMinutos = Math.round(decimal * 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos}m`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h ${minutos}m`;
};

export const calcularHorasExtra = (fila: FichadaExtra): number | null => {
  if (!fila.fecha_hora_salida) return null;
  const horas = horasEntre(fila.fecha_hora_entrada, fila.fecha_hora_salida);
  return horas > 0 ? horas : 0;
};

export const sumarHoras = (filas: FichadaExtra[]): number => {
  return filas.reduce((acc, fila) => acc + (calcularHorasExtra(fila) ?? 0), 0);
};

export const evaluarExtra = (
  fila: FichadaExtra,
  ahora: Date = new Date(),
): ExtraEvaluada => {
  const hasta = fila.fecha_hora_salida ?? ahora.toISOString();
  const horas = Math.max(0, horasEntre(fila.fecha_hora_entrada, hasta));
  const abierta = !fila.fecha_hora_salida;
  return {
    horas,
    abierta,
    excedeLimite: horas > LIMITE_FICHADA_EXTRA_HORAS,
    requiereRevision: horas > UMBRAL_REVISAR_EXTRA_HORAS,
  };
};

export const getEstadoEmpleado = async (
  documento: string,
  municipioId: string,
): Promise<EstadoEmpleado> => {
  const { data, error } = await supabase.rpc("get_estado_fichadas", {
    dni_input: documento,
    municipio_input: municipioId,
  });

  if (error) throw error;

  const payload = (data ?? {}) as {
    extra_abierta?: FichadaExtra | null;
    ultima_fichada?: Fichada | null;
  };

  const extraAbierta = payload.extra_abierta ?? null;
  if (extraAbierta) {
    return {
      estado: "extra_abierta",
      desde: extraAbierta.fecha_hora_entrada,
      extraAbierta,
    };
  }

  const ultima = payload.ultima_fichada ?? null;
  if (ultima?.tipo === "entrada") {
    const horasDesde = horasEntre(ultima.fecha_hora, new Date().toISOString());
    if (horasDesde <= VENTANA_NORMAL_ABIERTA_HORAS) {
      return {
        estado: "normal_abierta",
        desde: ultima.fecha_hora,
      };
    }
  }

  return { estado: "libre" };
};

export const validarAccion = (
  estado: EstadoEmpleado,
  tipoJornada: TipoJornada,
  tipoFichada: TipoFichada,
): ValidacionAccion => {
  if (estado.estado === "extra_abierta") {
    const esSalidaExtra = tipoJornada === "extra" && tipoFichada === "salida";
    if (esSalidaExtra) return { ok: true };

    const desde = estado.desde ? formatHoraCorta(estado.desde) : "";
    const mismoDia = estado.desde ? esMismoDiaLocal(estado.desde) : true;

    if (mismoDia) {
      return {
        ok: true,
        alerta: `Tenés una fichada de horas extras abierta desde las ${desde}. Se registrará igual.`,
      };
    }

    const fecha = estado.desde ? formatFechaCorta(estado.desde) : "";
    return {
      ok: true,
      alerta: `Tenés una fichada de horas extras sin cerrar del ${fecha} a las ${desde}. Se registrará igual.`,
    };
  }

  if (estado.estado === "normal_abierta") {
    const esSalidaNormal =
      tipoJornada === "normal" && tipoFichada === "salida";
    if (esSalidaNormal) return { ok: true };

    const desde = estado.desde ? formatHoraCorta(estado.desde) : "";
    return {
      ok: true,
      alerta: `Tenés una entrada de jornada normal abierta desde las ${desde}. Se registrará igual.`,
    };
  }

  if (tipoFichada === "salida") {
    if (tipoJornada === "extra") {
      return {
        ok: true,
        alerta:
          "No tenés una entrada de horas extras abierta. Se registrará como entrada extra.",
      };
    }
    return {
      ok: true,
      alerta:
        "No tenés una entrada de jornada normal abierta. Se registrará igual.",
    };
  }

  return { ok: true };
};

export const emparejarJornadas = (fichadas: Fichada[]): Jornada[] => {
  const porDocumento = new Map<string, Fichada[]>();
  for (const f of fichadas) {
    const lista = porDocumento.get(f.documento) ?? [];
    lista.push(f);
    porDocumento.set(f.documento, lista);
  }

  const jornadas: Jornada[] = [];

  for (const [documento, eventos] of porDocumento) {
    const ordenados = [...eventos].sort(
      (a, b) =>
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
    );

    let i = 0;
    while (i < ordenados.length) {
      const actual = ordenados[i];
      if (actual.tipo !== "entrada") {
        i += 1;
        continue;
      }

      const siguiente = ordenados[i + 1];
      if (siguiente?.tipo === "salida") {
        const horas = horasEntre(actual.fecha_hora, siguiente.fecha_hora);
        const dentroDeVentana = horas > 0 && horas <= VENTANA_NORMAL_ABIERTA_HORAS;
        if (dentroDeVentana) {
          jornadas.push({
            documento,
            entrada: actual,
            salida: siguiente,
            horas,
            incompleta: false,
            excedeLimite: horas > LIMITE_JORNADA_NORMAL_HORAS,
          });
          i += 2;
          continue;
        }
      }

      jornadas.push({
        documento,
        entrada: actual,
        horas: null,
        incompleta: true,
        excedeLimite: false,
      });
      i += 1;
    }
  }

  return jornadas.sort(
    (a, b) =>
      new Date(b.entrada.fecha_hora).getTime() -
      new Date(a.entrada.fecha_hora).getTime(),
  );
};

export const agruparHorasPorEmpleado = (
  filas: FichadaExtra[],
): Array<{ documento: string; cantidad: number; totalHoras: number }> => {
  const mapa = new Map<string, { cantidad: number; totalHoras: number }>();
  for (const fila of filas) {
    const horas = calcularHorasExtra(fila);
    if (horas == null) continue;
    const actual = mapa.get(fila.documento) ?? { cantidad: 0, totalHoras: 0 };
    actual.cantidad += 1;
    actual.totalHoras += horas;
    mapa.set(fila.documento, actual);
  }
  return Array.from(mapa.entries())
    .map(([documento, datos]) => ({ documento, ...datos }))
    .sort((a, b) => b.totalHoras - a.totalHoras);
};
