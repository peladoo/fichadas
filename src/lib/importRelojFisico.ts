import { isValidDNI, sanitizeDNI } from "@/lib/utils";

export const RELOJ_DEBOUNCE_MS = 30_000;

export type RelojFileFormat = "tsv" | "legacy";
export type TipoFichada = "entrada" | "salida";

export interface RelojDependencia {
  id: string;
  nombre: string;
  codigo?: string;
}

export interface ParsedRelojRecord {
  fecha_hora: string;
  documento: string;
  tipo?: TipoFichada;
  dispositivo: string;
  dependenciaId?: string;
  dependenciaNombre?: string;
  dependenciaSinMatch?: boolean;
  nombre?: string;
  apellido?: string;
  lineaOriginal: string;
  error?: string;
  skipped?: "debounce";
}

export interface ExistingFichada {
  documento: string;
  fecha_hora: string;
  tipo: string;
}

export interface RelojParseResult {
  format: RelojFileFormat;
  records: ParsedRelojRecord[];
}

const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

const LEGACY_DATE_BOUNDS = {
  yearMin: 2000,
  yearMax: 2100,
};

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function parseFechaHoraMs(fechaHora: string): number | null {
  const match = fechaHora.trim().match(DATETIME_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function pad2(value: number | string): string {
  return String(value).padStart(2, "0");
}

function mapEstado(raw: string): TipoFichada | null {
  const normalized = normalizeName(raw).replace(/\./g, "");
  if (normalized === "entrada" || normalized === "entrada te") return "entrada";
  if (normalized === "salida" || normalized === "salida te") return "salida";
  return null;
}

function isTsvLine(line: string): boolean {
  if (!line.includes("\t")) return false;
  const first = line.split("\t")[0].trim();
  const normalized = normalizeName(first);
  return (
    normalized === "tiempo" ||
    normalized.startsWith("tiempo ") ||
    DATETIME_RE.test(first)
  );
}

function isHeaderLine(line: string): boolean {
  const first = normalizeName(line.split("\t")[0] || "");
  return first === "tiempo" || first.startsWith("tiempo ");
}

function headerIndexMap(headerLine: string): Record<string, number> {
  const cols = headerLine.split("\t").map((c) => normalizeName(c));
  const map: Record<string, number> = {};
  cols.forEach((name, i) => {
    if (name) map[name] = i;
  });
  return map;
}

function col(
  cells: string[],
  headers: Record<string, number> | null,
  names: string[],
  fallbackIndex: number,
): string {
  if (headers) {
    for (const name of names) {
      if (name in headers) return (cells[headers[name]] || "").trim();
    }
  }
  return (cells[fallbackIndex] || "").trim();
}

function detectFormat(lines: string[]): RelojFileFormat {
  const first = lines.find((l) => l.trim().length > 0);
  if (first && isTsvLine(first)) return "tsv";
  if (lines.some(isTsvLine)) return "tsv";
  return "legacy";
}

function parseTsv(lines: string[]): ParsedRelojRecord[] {
  const records: ParsedRelojRecord[] = [];
  let headers: Record<string, number> | null = null;
  let started = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (!started && isHeaderLine(line)) {
      headers = headerIndexMap(line);
      started = true;
      continue;
    }
    started = true;

    const cells = line.split("\t");
    const tiempo = col(cells, headers, ["tiempo"], 0);
    const dniRaw = col(cells, headers, ["id de usuario", "dni", "documento"], 1);
    const nombre = col(cells, headers, ["nombre"], 2);
    const apellido = col(cells, headers, ["apellido"], 3);
    const dispositivo = col(cells, headers, ["dispositivo"], 5);
    const estado = col(cells, headers, ["estado"], 8);

    const documento = sanitizeDNI(dniRaw);
    const ms = parseFechaHoraMs(tiempo);
    const tipo = mapEstado(estado);

    if (!isValidDNI(documento)) {
      records.push({
        fecha_hora: tiempo,
        documento,
        dispositivo,
        nombre,
        apellido,
        lineaOriginal: line,
        error: "DNI inválido (debe tener 7 u 8 dígitos)",
      });
      continue;
    }

    if (ms === null) {
      records.push({
        fecha_hora: tiempo,
        documento,
        dispositivo,
        nombre,
        apellido,
        lineaOriginal: line,
        error: "Fecha u hora inválida (se espera YYYY-MM-DD HH:MM:SS)",
      });
      continue;
    }

    if (!tipo) {
      records.push({
        fecha_hora: tiempo,
        documento,
        dispositivo,
        nombre,
        apellido,
        lineaOriginal: line,
        error: estado
          ? `Estado no reconocido: ${estado}`
          : "Estado vacío",
      });
      continue;
    }

    records.push({
      fecha_hora: tiempo.replace("T", " ").trim(),
      documento,
      tipo,
      dispositivo,
      nombre,
      apellido,
      lineaOriginal: line,
    });
  }

  return records;
}

function parseLegacy(lines: string[]): ParsedRelojRecord[] {
  const records: ParsedRelojRecord[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const tokens = line.trim().split(/\s+/);

    if (tokens.length !== 6) {
      records.push({
        fecha_hora: "",
        documento: sanitizeDNI(tokens[0] || ""),
        dispositivo: "",
        lineaOriginal: line,
        error: `Se esperaban 6 valores (DNI DD MM YYYY HH MM), se encontraron ${tokens.length}`,
      });
      continue;
    }

    const [dni, dd, mm, yyyy, hh, min] = tokens;
    const documento = sanitizeDNI(dni);

    if (!isValidDNI(documento)) {
      records.push({
        fecha_hora: "",
        documento,
        dispositivo: "",
        lineaOriginal: line,
        error: "DNI inválido (debe tener 7 u 8 dígitos)",
      });
      continue;
    }

    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10);
    const year = parseInt(yyyy, 10);
    const hour = parseInt(hh, 10);
    const minute = parseInt(min, 10);

    const fechaValida =
      !Number.isNaN(day) &&
      day >= 1 &&
      day <= 31 &&
      !Number.isNaN(month) &&
      month >= 1 &&
      month <= 12 &&
      !Number.isNaN(year) &&
      year >= LEGACY_DATE_BOUNDS.yearMin &&
      year <= LEGACY_DATE_BOUNDS.yearMax &&
      !Number.isNaN(hour) &&
      hour >= 0 &&
      hour <= 23 &&
      !Number.isNaN(minute) &&
      minute >= 0 &&
      minute <= 59;

    if (!fechaValida) {
      records.push({
        fecha_hora: "",
        documento,
        dispositivo: "",
        lineaOriginal: line,
        error: "Fecha u hora inválida",
      });
      continue;
    }

    const fecha_hora = `${yyyy}-${pad2(mm)}-${pad2(dd)} ${pad2(hh)}:${pad2(min)}:00`;
    records.push({
      fecha_hora,
      documento,
      dispositivo: "",
      lineaOriginal: line,
    });
  }

  return records;
}

export function parseRelojText(text: string): RelojParseResult {
  const lines = text.split(/\r?\n/);
  const format = detectFormat(lines);
  const records = format === "tsv" ? parseTsv(lines) : parseLegacy(lines);
  return { format, records };
}

const DEVICE_ALIASES: Record<string, string[]> = {
  horno: ["horno - corralon municipal"],
  "parques y paseo": ["parques y paseos"],
  "parques y paseos": ["parques y paseos"],
  "edificio municipal": ["edificio municipal"],
  juzgado: ["juzgado y transito"],
};

export function resolveDependenciaId(
  dispositivo: string,
  dependencias: RelojDependencia[],
): RelojDependencia | null {
  const key = normalizeName(dispositivo);
  if (!key) return null;

  const dependencyKeys = (dep: RelojDependencia) => [
    normalizeName(dep.nombre),
    normalizeName(dep.codigo || ""),
  ].filter(Boolean);
  const exact = dependencias.find((dep) => dependencyKeys(dep).includes(key));
  if (exact) return exact;

  const aliasKeys = DEVICE_ALIASES[key] || [];
  const aliased = dependencias.find((dep) =>
    dependencyKeys(dep).some((depKey) => aliasKeys.includes(depKey)),
  );
  if (aliased) return aliased;

  const candidates = dependencias.filter((dep) =>
    dependencyKeys(dep).some(
      (depKey) => depKey.includes(key) || key.includes(depKey),
    ),
  );
  return candidates.sort((a, b) => a.nombre.length - b.nombre.length)[0] || null;
}

export function attachDependencias(
  records: ParsedRelojRecord[],
  dependencias: RelojDependencia[],
): ParsedRelojRecord[] {
  return records.map((record) => {
    if (record.error) return record;
    const dep = resolveDependenciaId(record.dispositivo, dependencias);
    if (!dep) {
      return {
        ...record,
        dependenciaSinMatch: true,
      };
    }
    return {
      ...record,
      dependenciaId: dep.id,
      dependenciaNombre: dep.nombre,
      dependenciaSinMatch: false,
    };
  });
}

export function unmatchedDispositivos(
  records: ParsedRelojRecord[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const record of records) {
    if (!record.dependenciaSinMatch) continue;
    const key = normalizeName(record.dispositivo);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(record.dispositivo);
  }
  return result;
}

export function debounceRecords(
  records: ParsedRelojRecord[],
  windowMs: number = RELOJ_DEBOUNCE_MS,
): ParsedRelojRecord[] {
  const indexed = records.map((record, index) => ({ record, index }));
  const valid = indexed.filter(
    (item) => !item.record.error && item.record.tipo && item.record.fecha_hora,
  );

  valid.sort((a, b) => {
    const ta = parseFechaHoraMs(a.record.fecha_hora) ?? 0;
    const tb = parseFechaHoraMs(b.record.fecha_hora) ?? 0;
    if (ta !== tb) return ta - tb;
    return a.index - b.index;
  });

  const lastKept = new Map<string, number>();
  const skippedIndexes = new Set<number>();

  for (const item of valid) {
    const tipo = item.record.tipo!;
    const key = `${item.record.documento}|${tipo}`;
    const t = parseFechaHoraMs(item.record.fecha_hora);
    if (t === null) continue;
    const prev = lastKept.get(key);
    if (prev !== undefined && t - prev < windowMs) {
      skippedIndexes.add(item.index);
      continue;
    }
    lastKept.set(key, t);
  }

  return records.map((record, index) =>
    skippedIndexes.has(index)
      ? { ...record, skipped: "debounce" as const }
      : record,
  );
}

export function classifyRecords(records: ParsedRelojRecord[]) {
  const invalid: ParsedRelojRecord[] = [];
  const debounced: ParsedRelojRecord[] = [];
  const valid: ParsedRelojRecord[] = [];

  for (const record of records) {
    if (record.error) invalid.push(record);
    else if (record.skipped === "debounce") debounced.push(record);
    else valid.push(record);
  }

  return { valid, invalid, debounced };
}

function existingKey(documento: string, fechaHora: string, tipo: string) {
  return `${documento}|${fechaHora}|${tipo}`;
}

function normalizeExistingFechaHora(fechaHora: string): string {
  const trimmed = fechaHora.trim().replace("T", " ");
  const match = trimmed.match(DATETIME_RE);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  }
  const noMs = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/,
  );
  if (noMs) return `${noMs[1]} ${noMs[2]}`;
  return trimmed.slice(0, 19);
}

export function filterAgainstExisting(
  records: ParsedRelojRecord[],
  existing: ExistingFichada[],
  windowMs: number = RELOJ_DEBOUNCE_MS,
): { toInsert: ParsedRelojRecord[]; duplicados: number } {
  const existingKeys = new Set(
    existing.map((f) =>
      existingKey(
        f.documento,
        normalizeExistingFechaHora(f.fecha_hora),
        f.tipo,
      ),
    ),
  );

  const existingTimes = new Map<string, number[]>();
  for (const f of existing) {
    const ms = parseFechaHoraMs(normalizeExistingFechaHora(f.fecha_hora));
    if (ms === null) continue;
    const key = `${f.documento}|${f.tipo}`;
    const list = existingTimes.get(key);
    if (list) list.push(ms);
    else existingTimes.set(key, [ms]);
  }

  let duplicados = 0;
  const toInsert: ParsedRelojRecord[] = [];

  for (const record of records) {
    if (!record.tipo) {
      duplicados++;
      continue;
    }
    const key = existingKey(record.documento, record.fecha_hora, record.tipo);
    if (existingKeys.has(key)) {
      duplicados++;
      continue;
    }

    const t = parseFechaHoraMs(record.fecha_hora);
    const times = existingTimes.get(`${record.documento}|${record.tipo}`) || [];
    const near = t !== null && times.some((other) => Math.abs(t - other) < windowMs);
    if (near) {
      duplicados++;
      continue;
    }

    toInsert.push(record);
    existingKeys.add(key);
    if (t !== null) {
      const listKey = `${record.documento}|${record.tipo}`;
      const list = existingTimes.get(listKey);
      if (list) list.push(t);
      else existingTimes.set(listKey, [t]);
    }
  }

  return { toInsert, duplicados };
}

function formatUtcMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = pad2(d.getUTCMonth() + 1);
  const da = pad2(d.getUTCDate());
  const h = pad2(d.getUTCHours());
  const mi = pad2(d.getUTCMinutes());
  const s = pad2(d.getUTCSeconds());
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
}

export function dateRangeOf(
  records: ParsedRelojRecord[],
): { min: string; max: string } | null {
  const times = records
    .map((r) => r.fecha_hora)
    .filter(Boolean)
    .sort();
  if (times.length === 0) return null;
  return { min: times[0], max: times[times.length - 1] };
}

export function expandDateRange(
  range: { min: string; max: string },
  deltaMs: number,
): { min: string; max: string } {
  const minMs = parseFechaHoraMs(range.min);
  const maxMs = parseFechaHoraMs(range.max);
  return {
    min: minMs === null ? range.min : formatUtcMs(minMs - deltaMs),
    max: maxMs === null ? range.max : formatUtcMs(maxMs + deltaMs),
  };
}
