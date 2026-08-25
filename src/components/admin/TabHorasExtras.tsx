"use client";

import { useState, useEffect, useCallback } from "react";
import {
  supabase,
  type Dependencia,
  type FichadaExtra,
  type FichadaExtraConDeps,
} from "@/lib/supabase";
import {
  handleSupabaseError,
  getTodayRange,
  getThisWeekRange,
  getThisMonthRange,
  getSemanaLunesRange,
  getMesActualRange,
  logger,
} from "@/lib/utils";
import {
  downloadFile,
  rowsToCSV,
  generateRelojLine,
} from "@/lib/export";
import {
  agruparHorasPorEmpleado,
  calcularHorasExtra,
  evaluarExtra,
  formatHoras,
  sumarHoras,
} from "@/lib/jornadas";
import { AlertCircle, Plus } from "lucide-react";
import FichadasFilters from "./FichadasFilters";
import ExportButtons, { type ExportAction } from "./ExportButtons";
import PaginationBar, { PAGE_SIZE_OPTIONS } from "./PaginationBar";
import ExtrasTable from "./ExtrasTable";
import ExtraModal from "./ExtraModal";
import ExtrasStatsCards from "./ExtrasStatsCards";
import ExtrasResumenTable from "./ExtrasResumenTable";
import EditRegistroModal, { type EditTarget } from "./EditRegistroModal";

const EXPORT_BATCH_SIZE = 1000;

const TIPO_OPTIONS = [
  { value: "", label: "Todas" },
  { value: "completas", label: "Completas" },
  { value: "en_curso", label: "En curso" },
  { value: "revisar", label: "Requieren revisión" },
];

interface TabHorasExtrasProps {
  refreshKey: number;
}

export default function TabHorasExtras({ refreshKey }: TabHorasExtrasProps) {
  const [extras, setExtras] = useState<FichadaExtraConDeps[]>([]);
  const [displayExtras, setDisplayExtras] = useState<FichadaExtraConDeps[]>([]);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [exportingAll, setExportingAll] = useState(false);

  const [searchDni, setSearchDni] = useState("");
  const [selectedDependencia, setSelectedDependencia] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [horasSemana, setHorasSemana] = useState(0);
  const [horasMes, setHorasMes] = useState(0);
  const [empleadosMes, setEmpleadosMes] = useState(0);
  const [extrasAbiertas, setExtrasAbiertas] = useState(0);

  const [selectedExtra, setSelectedExtra] = useState<FichadaExtraConDeps | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const attachDeps = (
    rows: FichadaExtra[],
    deps: Dependencia[],
  ): FichadaExtraConDeps[] =>
    rows.map((row) => ({
      ...row,
      dependenciaEntrada: deps.find((d) => d.id === row.dependencia_id_entrada),
      dependenciaSalida: deps.find((d) => d.id === row.dependencia_id_salida),
    }));

  const buildFilteredQuery = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery: any) => {
      let query = baseQuery;
      if (searchDni) query = query.ilike("documento", `%${searchDni}%`);
      if (selectedDependencia) {
        query = query.or(
          `dependencia_id_entrada.eq.${selectedDependencia},dependencia_id_salida.eq.${selectedDependencia}`,
        );
      }
      if (fechaDesde)
        query = query.gte("fecha_hora_entrada", `${fechaDesde}T00:00:00`);
      if (fechaHasta)
        query = query.lte("fecha_hora_entrada", `${fechaHasta}T23:59:59.999`);
      if (selectedTipo === "completas") {
        query = query.not("fecha_hora_salida", "is", null);
      } else if (selectedTipo === "en_curso") {
        query = query.is("fecha_hora_salida", null);
      }
      return query;
    },
    [searchDni, selectedDependencia, selectedTipo, fechaDesde, fechaHasta],
  );

  const applyClientFilters = useCallback(
    (data: FichadaExtraConDeps[]) => {
      if (selectedTipo !== "revisar") return data;
      return data.filter((row) => evaluarExtra(row).requiereRevision);
    },
    [selectedTipo],
  );

  useEffect(() => {
    setDisplayExtras(applyClientFilters(extras));
  }, [extras, applyClientFilters]);

  const fetchAllFiltered = async (
    depData: Dependencia[],
  ): Promise<FichadaExtraConDeps[]> => {
    const allRecords: FichadaExtraConDeps[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const baseQuery = supabase.from("fichadas_extras").select("*");
      const { data, error: fetchError } = await buildFilteredQuery(baseQuery)
        .order("fecha_hora_entrada", { ascending: false })
        .range(offset, offset + EXPORT_BATCH_SIZE - 1);
      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...attachDeps(data, depData));
        offset += EXPORT_BATCH_SIZE;
        if (data.length < EXPORT_BATCH_SIZE) hasMore = false;
      }
    }
    return applyClientFilters(allRecords);
  };

  const loadKpis = async (depsFilter: string) => {
    const semana = getSemanaLunesRange();
    const mes = getMesActualRange();
    const desdeKpi = semana.desde < mes.desde ? semana.desde : mes.desde;

    let kpiQuery = supabase
      .from("fichadas_extras")
      .select("*")
      .gte("fecha_hora_entrada", `${desdeKpi}T00:00:00`);
    if (depsFilter) {
      kpiQuery = kpiQuery.or(
        `dependencia_id_entrada.eq.${depsFilter},dependencia_id_salida.eq.${depsFilter}`,
      );
    }
    const { data: kpiRows, error: kpiError } = await kpiQuery;
    if (kpiError) throw kpiError;

    const rows = (kpiRows || []) as FichadaExtra[];
    const semanaDesde = `${semana.desde}T00:00:00`;
    const mesDesde = `${mes.desde}T00:00:00`;
    const delMes = rows.filter((r) => r.fecha_hora_entrada >= mesDesde);
    const deLaSemana = rows.filter((r) => r.fecha_hora_entrada >= semanaDesde);
    setHorasMes(sumarHoras(delMes));
    setHorasSemana(sumarHoras(deLaSemana));
    setEmpleadosMes(
      new Set(
        delMes
          .filter((r) => r.fecha_hora_salida)
          .map((r) => r.documento),
      ).size,
    );

    let abiertasQuery = supabase
      .from("fichadas_extras")
      .select("id", { count: "exact", head: true })
      .is("fecha_hora_salida", null);
    if (depsFilter) {
      abiertasQuery = abiertasQuery.or(
        `dependencia_id_entrada.eq.${depsFilter},dependencia_id_salida.eq.${depsFilter}`,
      );
    }
    const { count, error: abiertasError } = await abiertasQuery;
    if (abiertasError) throw abiertasError;
    setExtrasAbiertas(count || 0);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: depData, error: depError } = await supabase
        .from("dependencias")
        .select("*")
        .order("nombre");
      if (depError) throw depError;
      setDependencias(depData || []);

      if (selectedTipo === "revisar") {
        const all = await fetchAllFiltered(depData || []);
        const revisadas = all.filter((row) => evaluarExtra(row).requiereRevision);
        setTotalCount(revisadas.length);
        const from = (currentPage - 1) * itemsPerPage;
        setExtras(revisadas.slice(from, from + itemsPerPage));
      } else {
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        const baseQuery = supabase
          .from("fichadas_extras")
          .select("*", { count: "exact" });
        const {
          data,
          error: extrasError,
          count,
        } = await buildFilteredQuery(baseQuery)
          .order("fecha_hora_entrada", { ascending: false })
          .range(from, to);
        if (extrasError) throw extrasError;
        setTotalCount(count || 0);
        setExtras(attachDeps((data || []) as FichadaExtra[], depData || []));
      }

      await loadKpis(selectedDependencia);
    } catch (err) {
      logger.error("Error cargando extras:", err);
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    itemsPerPage,
    searchDni,
    selectedDependencia,
    selectedTipo,
    fechaDesde,
    fechaHasta,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchDni,
    selectedDependencia,
    selectedTipo,
    fechaDesde,
    fechaHasta,
    itemsPerPage,
  ]);

  const extraToCsvRow = (e: FichadaExtraConDeps): string[] => {
    const evalE = evaluarExtra(e);
    const estado = evalE.abierta
      ? "En curso"
      : evalE.requiereRevision
        ? "Revisar"
        : "Completa";
    return [
      new Date(e.fecha_hora_entrada).toLocaleDateString("es-AR"),
      e.documento,
      new Date(e.fecha_hora_entrada).toLocaleString("es-AR", { hour12: false }),
      e.fecha_hora_salida
        ? new Date(e.fecha_hora_salida).toLocaleString("es-AR", { hour12: false })
        : "",
      formatHoras(calcularHorasExtra(e)),
      e.dependenciaEntrada?.nombre || "N/A",
      e.dependenciaSalida?.nombre || "",
      e.latitud_entrada && e.longitud_entrada
        ? `${e.latitud_entrada}, ${e.longitud_entrada}`
        : "",
      e.latitud_salida && e.longitud_salida
        ? `${e.latitud_salida}, ${e.longitud_salida}`
        : "",
      estado,
    ];
  };

  const csvHeaders = [
    "Fecha",
    "DNI",
    "Entrada",
    "Salida",
    "Horas",
    "Dependencia entrada",
    "Dependencia salida",
    "Ubicación entrada",
    "Ubicación salida",
    "Estado",
  ];

  const exportPageCSV = () => {
    downloadFile(
      rowsToCSV(csvHeaders, displayExtras.map(extraToCsvRow)),
      `extras_pagina_${currentPage}_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const exportAllCSV = async () => {
    setExportingAll(true);
    try {
      const all = await fetchAllFiltered(dependencias);
      downloadFile(
        rowsToCSV(csvHeaders, all.map(extraToCsvRow)),
        `extras_completo_${new Date().toISOString().split("T")[0]}.csv`,
        "text/csv;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando extras CSV:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const exportResumenCSV = async () => {
    setExportingAll(true);
    try {
      const all = await fetchAllFiltered(dependencias);
      const resumen = agruparHorasPorEmpleado(all);
      downloadFile(
        rowsToCSV(
          ["DNI", "Cantidad de fichadas", "Total horas decimal", "Total HH:MM"],
          resumen.map((r) => [
            r.documento,
            String(r.cantidad),
            r.totalHoras.toFixed(2),
            formatHoras(r.totalHoras),
          ]),
        ),
        `extras_resumen_${new Date().toISOString().split("T")[0]}.csv`,
        "text/csv;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando resumen:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const extrasToTxt = (rows: FichadaExtraConDeps[]) => {
    const lines: string[] = [];
    for (const row of rows) {
      if (!row.fecha_hora_salida) continue;
      lines.push(generateRelojLine(row.fecha_hora_entrada, row.documento));
      lines.push(generateRelojLine(row.fecha_hora_salida, row.documento));
    }
    return lines.join("\n");
  };

  const exportPageTXT = () => {
    downloadFile(
      extrasToTxt(displayExtras),
      `extras_pagina_${currentPage}_${new Date().toISOString().split("T")[0]}.txt`,
      "text/plain;charset=utf-8;",
    );
  };

  const exportAllTXT = async () => {
    setExportingAll(true);
    try {
      const all = await fetchAllFiltered(dependencias);
      downloadFile(
        extrasToTxt(all),
        `extras_completo_${new Date().toISOString().split("T")[0]}.txt`,
        "text/plain;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando extras TXT:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const clearFilters = () => {
    setSearchDni("");
    setSelectedDependencia("");
    setSelectedTipo("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const setQuickFilter = (filterType: "hoy" | "semana" | "mes") => {
    const range =
      filterType === "hoy"
        ? getTodayRange()
        : filterType === "semana"
          ? getThisWeekRange()
          : getThisMonthRange();
    setFechaDesde(range.desde);
    setFechaHasta(range.hasta);
  };

  const pageActions: ExportAction[] = [
    {
      id: "txt-page",
      label: `TXT página (${displayExtras.length})`,
      onClick: exportPageTXT,
      disabled: displayExtras.length === 0,
      variant: "primary",
      icon: "file",
    },
    {
      id: "csv-page",
      label: `CSV página (${displayExtras.length})`,
      onClick: exportPageCSV,
      disabled: displayExtras.length === 0,
      variant: "green",
    },
  ];

  const allActions: ExportAction[] = [
    {
      id: "txt-all",
      label: `Exportar Todo TXT (${totalCount})`,
      onClick: exportAllTXT,
      disabled: exportingAll || totalCount === 0,
      loading: exportingAll,
      variant: "dark",
      icon: "file",
    },
    {
      id: "csv-all",
      label: `CSV detalle (${totalCount})`,
      onClick: exportAllCSV,
      disabled: exportingAll || totalCount === 0,
      loading: exportingAll,
      variant: "blue",
    },
    {
      id: "csv-resumen",
      label: "CSV resumen por empleado",
      onClick: exportResumenCSV,
      disabled: exportingAll,
      loading: exportingAll,
      variant: "green",
    },
  ];

  const resumen = agruparHorasPorEmpleado(displayExtras);

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
        <ExtrasStatsCards
          horasSemana={formatHoras(horasSemana)}
          horasMes={formatHoras(horasMes)}
          empleadosMes={empleadosMes}
          extrasAbiertas={extrasAbiertas}
          onClickAbiertas={() => setSelectedTipo("en_curso")}
        />
      </div>

      <FichadasFilters
        searchDni={searchDni}
        setSearchDni={setSearchDni}
        selectedDependencia={selectedDependencia}
        setSelectedDependencia={setSelectedDependencia}
        selectedTipo={selectedTipo}
        setSelectedTipo={setSelectedTipo}
        tipoOptions={TIPO_OPTIONS}
        tipoLabel="Estado"
        soloFueraDeRango={false}
        setSoloFueraDeRango={() => undefined}
        showGpsFilter={false}
        fechaDesde={fechaDesde}
        setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        setFechaHasta={setFechaHasta}
        dependencias={dependencias}
        onClearFilters={clearFilters}
        onQuickFilter={setQuickFilter}
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ExportButtons
            pageActions={pageActions}
            allActions={allActions}
            exportingAll={exportingAll}
          />
          <button
            type="button"
            onClick={() => setEditTarget({ kind: "extra" })}
            className="flex items-center gap-2 bg-[#076633] hover:bg-[#054d26] text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo registro manual
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Fichadas de horas extras
          </h2>
        </div>
        <ExtrasTable
          extras={displayExtras}
          loading={loading}
          onSelectExtra={setSelectedExtra}
          onEditExtra={(e) => setEditTarget({ kind: "extra", registro: e })}
        />
        {!loading && (
          <PaginationBar
            currentPage={currentPage}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resumen por empleado
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Totales de la página actual filtrada (solo fichadas cerradas)
          </p>
        </div>
        <ExtrasResumenTable resumen={resumen} />
      </div>

      <ExtraModal extra={selectedExtra} onClose={() => setSelectedExtra(null)} />
      <EditRegistroModal
        target={editTarget}
        dependencias={dependencias}
        onClose={() => setEditTarget(null)}
        onSaved={loadData}
      />
    </>
  );
}
