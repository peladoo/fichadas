"use client";

import { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import { supabase, type Dependencia } from "@/lib/supabase";
import { logger } from "@/lib/utils";
import {
  attachDependencias,
  classifyRecords,
  dateRangeOf,
  debounceRecords,
  expandDateRange,
  filterAgainstExisting,
  parseRelojText,
  toArgentinaIso,
  unmatchedDispositivos,
  RELOJ_DEBOUNCE_MS,
  type ParsedRelojRecord,
  type RelojFileFormat,
} from "@/lib/importRelojFisico";

interface ImportResult {
  insertados: number;
  duplicados: number;
  errores: number;
  detallesErrores: string[];
}

interface ImportRelojFisicoProps {
  dependencias: Dependencia[];
  onImportComplete: () => void;
}

export default function ImportRelojFisico({
  dependencias,
  onImportComplete,
}: ImportRelojFisicoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<RelojFileFormat | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRelojRecord[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [dependenciaId, setDependenciaId] = useState<string>("");
  const [fallbackDependenciaId, setFallbackDependenciaId] = useState<string>("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dependenciaSeleccionada = useMemo(
    () => dependencias.find((d) => d.id === dependenciaId),
    [dependencias, dependenciaId],
  );

  const processedRecords = useMemo(() => {
    if (parsedRecords.length === 0) return [];
    if (format === "tsv") {
      return debounceRecords(attachDependencias(parsedRecords, dependencias));
    }
    return debounceRecords(
      parsedRecords.map((r) => (r.error ? r : { ...r, tipo })),
    );
  }, [parsedRecords, dependencias, format, tipo]);

  const { valid, invalid, debounced } = useMemo(
    () => classifyRecords(processedRecords),
    [processedRecords],
  );

  const dispositivosSinMatch = useMemo(
    () => unmatchedDispositivos(processedRecords),
    [processedRecords],
  );

  const recordsConFallback = useMemo(
    () =>
      processedRecords.map((record) =>
        record.dependenciaSinMatch && fallbackDependenciaId
          ? {
              ...record,
              dependenciaId: fallbackDependenciaId,
              dependenciaNombre: "Dependencia fallback",
            }
          : record,
      ),
    [processedRecords, fallbackDependenciaId],
  );

  const validosConFallback = useMemo(
    () => classifyRecords(recordsConFallback).valid,
    [recordsConFallback],
  );

  const parseFile = (text: string) => {
    setParseError("");
    setResult(null);

    if (!text.trim()) {
      setParseError("El archivo está vacío.");
      setParsedRecords([]);
      setFormat(null);
      return;
    }

    const { format: detected, records } = parseRelojText(text);
    setFormat(detected);
    setParsedRecords(records);

    if (records.length === 0) {
      setParseError("Ninguna línea pudo ser parseada. Verificá el formato del archivo.");
      return;
    }

    const allInvalid = records.every((r) => r.error);
    if (allInvalid) {
      setParseError(
        "Ninguna línea pudo ser parseada. Verificá el formato del archivo.",
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setParsedRecords([]);
    setFormat(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseFile(text);
    };
    reader.readAsText(selectedFile, "utf-8");
  };

  const handleImport = async () => {
    const isTsv = format === "tsv";
    const ready = isTsv
      ? validosConFallback
      : valid.map((r) => ({
          ...r,
          tipo,
          dependenciaId,
          dependenciaNombre: dependenciaSeleccionada?.nombre,
        }));

    if (ready.length === 0) return;
    if (!isTsv && !dependenciaId) {
      setParseError("Seleccioná una dependencia antes de importar.");
      return;
    }

    const missingDep = ready.some((r) => !r.dependenciaId || !r.tipo);
    if (missingDep) {
      setParseError("Falta dependencia o tipo en uno o más registros.");
      return;
    }

    setImporting(true);
    setResult(null);
    setProgress({ current: 0, total: ready.length });

    const importResult: ImportResult = {
      insertados: 0,
      duplicados: 0,
      errores: 0,
      detallesErrores: [],
    };

    try {
      const documentosUnicos = [...new Set(ready.map((r) => r.documento))];
      const range = dateRangeOf(ready);
      const paddedRange = range
        ? expandDateRange(range, RELOJ_DEBOUNCE_MS)
        : null;

      const existingFichadas: {
        documento: string;
        fecha_hora: string;
        tipo: string;
      }[] = [];
      const DOC_CHUNK = 100;
      const PAGE_SIZE = 1000;

      for (let d = 0; d < documentosUnicos.length; d += DOC_CHUNK) {
        const docs = documentosUnicos.slice(d, d + DOC_CHUNK);
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          let existingQuery = supabase
            .from("fichadas")
            .select("documento, fecha_hora, tipo")
            .in("documento", docs);

          if (paddedRange) {
            existingQuery = existingQuery
              .gte("fecha_hora", toArgentinaIso(paddedRange.min))
              .lte("fecha_hora", toArgentinaIso(paddedRange.max));
          }

          const { data, error: fetchError } = await existingQuery.range(
            offset,
            offset + PAGE_SIZE - 1,
          );
          if (fetchError) throw fetchError;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            existingFichadas.push(...data);
            offset += PAGE_SIZE;
            if (data.length < PAGE_SIZE) hasMore = false;
          }
        }
      }

      const { toInsert, duplicados } = filterAgainstExisting(
        ready as ParsedRelojRecord[],
        existingFichadas || [],
      );
      importResult.duplicados = duplicados;

      const BATCH_SIZE = 100;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE).map((record) => ({
          documento: record.documento,
          tipo: record.tipo!,
          fecha_hora: toArgentinaIso(record.fecha_hora),
          dependencia_id: record.dependenciaId!,
          origen: "Reloj_Fisico",
        }));
        const { error: insertError } = await supabase.from("fichadas").insert(batch);

        if (insertError) {
          importResult.errores += batch.length;
          if (importResult.detallesErrores.length < 10) {
            importResult.detallesErrores.push(
              `Batch ${i / BATCH_SIZE + 1}: ${insertError.message}`,
            );
          }
          logger.error("Error insertando batch:", insertError);
        } else {
          importResult.insertados += batch.length;
        }

        setProgress({
          current: Math.min(i + BATCH_SIZE, toInsert.length),
          total: toInsert.length,
        });
      }
    } catch (err) {
      logger.error("Error en importación:", err);
      importResult.errores =
        ready.length - importResult.insertados - importResult.duplicados;
      importResult.detallesErrores.push(
        `Error general: ${err instanceof Error ? err.message : "desconocido"}`,
      );
    }

    setResult(importResult);
    setImporting(false);

    if (importResult.insertados > 0) {
      onImportComplete();
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedRecords([]);
    setFormat(null);
    setFallbackDependenciaId("");
    setResult(null);
    setParseError("");
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canImport =
    valid.length > 0 &&
    !importing &&
    (format === "legacy"
      ? Boolean(dependenciaId)
      : dispositivosSinMatch.length === 0 || Boolean(fallbackDependenciaId));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 p-2 rounded-lg">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Importar Reloj Físico
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Subir archivo .txt del reloj (Eventos de hoy) o formato legado DNI
              DD MM YYYY HH MM
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-6 space-y-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
              id="reloj-file-input"
            />
            <label
              htmlFor="reloj-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileText className="w-10 h-10 text-gray-400" />
              {file ? (
                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Haga clic para seleccionar archivo .txt
                  </span>
                  <span className="text-xs text-gray-500">
                    Export TSV del reloj o una fichada por línea: DNI DD MM YYYY
                    HH MM
                  </span>
                </>
              )}
            </label>
          </div>

          {parseError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{parseError}</p>
            </div>
          )}

          {(processedRecords.length > 0 || invalid.length > 0) && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Vista previa del archivo
                </h3>
                {format && (
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {format === "tsv" ? "Formato Eventos de hoy (TSV)" : "Formato legado"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{valid.length}</p>
                  <p className="text-xs text-green-700 dark:text-green-400">Válidos</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {debounced.length}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Debounce 30s
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{invalid.length}</p>
                  <p className="text-xs text-red-700 dark:text-red-400">Inválidos</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {processedRecords.length}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Total líneas
                  </p>
                </div>
              </div>

              {format === "legacy" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dependencia del reloj físico{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dependenciaId}
                      onChange={(e) => setDependenciaId(e.target.value)}
                      disabled={importing}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    >
                      <option value="">Seleccioná una dependencia...</option>
                      {dependencias.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.nombre}
                        </option>
                      ))}
                    </select>
                    {dependenciaSeleccionada && (
                      <p className="text-xs text-gray-500 mt-1">
                        Todas las fichadas se asignarán a:{" "}
                        <strong>{dependenciaSeleccionada.nombre}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de fichadas en este archivo{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTipo("entrada")}
                        disabled={importing}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                          tipo === "entrada"
                            ? "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400"
                            : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <LogIn className="w-4 h-4" />
                        <span className="font-semibold text-sm">Entrada</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipo("salida")}
                        disabled={importing}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                          tipo === "salida"
                            ? "bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20 dark:border-orange-500 dark:text-orange-400"
                            : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-semibold text-sm">Salida</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {format === "tsv" && valid.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr className="text-left text-gray-600 dark:text-gray-300">
                          <th className="px-2 py-1.5 font-medium">DNI</th>
                          <th className="px-2 py-1.5 font-medium">Fecha/hora</th>
                          <th className="px-2 py-1.5 font-medium">Tipo</th>
                          <th className="px-2 py-1.5 font-medium">Dependencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {valid.slice(0, 20).map((r, i) => (
                          <tr key={i} className="text-gray-800 dark:text-gray-200">
                            <td className="px-2 py-1 font-mono">{r.documento}</td>
                            <td className="px-2 py-1 font-mono">{r.fecha_hora}</td>
                            <td className="px-2 py-1 capitalize">{r.tipo}</td>
                            <td className="px-2 py-1">
                              {r.dependenciaNombre || r.dispositivo}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {valid.length > 20 && (
                    <p className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50">
                      Mostrando 20 de {valid.length} registros válidos
                    </p>
                  )}
                </div>
              )}

              {dispositivosSinMatch.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Dispositivos sin dependencia (creá o renombrá en el panel):
                  </p>
                  <ul className="text-xs text-amber-800 dark:text-amber-400 space-y-1 font-mono">
                    {dispositivosSinMatch.map((name) => (
                      <li key={name}>• {name}</li>
                    ))}
                  </ul>
                  <label className="block text-sm font-medium text-amber-900 dark:text-amber-200 mt-3 mb-1">
                    Dependencia para dispositivos sin match
                  </label>
                  <select
                    value={fallbackDependenciaId}
                    onChange={(e) => setFallbackDependenciaId(e.target.value)}
                    disabled={importing}
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
                  >
                    <option value="">Seleccioná una dependencia...</option>
                    {dependencias.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    Las filas se cargarán igualmente usando esta dependencia.
                  </p>
                </div>
              )}

              {invalid.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Líneas inválidas (no se importarán):
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto font-mono">
                    {invalid.slice(0, 10).map((r, i) => (
                      <li key={i}>
                        <span className="font-semibold">{r.error}:</span>{" "}
                        {r.documento || r.lineaOriginal.slice(0, 80)}
                      </li>
                    ))}
                    {invalid.length > 10 && (
                      <li className="italic font-sans">
                        ... y {invalid.length - 10} más
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {importing && progress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Insertando fichadas...</span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(progress.current / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-5 py-2.5 rounded-lg transition shadow-lg hover:shadow-xl text-sm font-medium"
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {importing
                    ? "Importando..."
                    : `Importar ${validosConFallback.length} registros`}
                </button>
                <button
                  onClick={resetForm}
                  disabled={importing}
                  className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg transition text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Resultado de la importación
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {result.insertados}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Insertados
                  </p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {result.duplicados}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    Duplicados
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">{result.errores}</p>
                  <p className="text-xs text-red-700 dark:text-red-400">Errores</p>
                </div>
              </div>

              {result.detallesErrores.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                    Detalle de errores:
                  </p>
                  <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                    {result.detallesErrores.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={resetForm}
                className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg transition text-sm"
              >
                Importar otro archivo
              </button>
            </div>
          )}

          {importing && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando registros, por favor espere...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
