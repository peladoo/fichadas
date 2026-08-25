"use client";

import { useState, useEffect, useCallback } from "react";
import {
  supabase,
  type Fichada,
  type FichadaConDependencia,
  type Dependencia,
} from "@/lib/supabase";
import {
  handleSupabaseError,
  getTodayRange,
  getThisWeekRange,
  getThisMonthRange,
  logger,
} from "@/lib/utils";
import { calcularDistancia } from "@/lib/gpsConfig";
import {
  downloadFile,
  generateCSVContent,
  generateTXTContent,
  rowsToCSV,
} from "@/lib/export";
import { emparejarJornadas, formatHoras, type Jornada } from "@/lib/jornadas";
import { AlertCircle, Plus, List, Clock } from "lucide-react";
import StatsCards from "./StatsCards";
import FichadasFilters from "./FichadasFilters";
import FichadasTable from "./FichadasTable";
import FichadaModal from "./FichadaModal";
import ExportButtons, { type ExportAction } from "./ExportButtons";
import JornadasTable from "./JornadasTable";
import PaginationBar, { PAGE_SIZE_OPTIONS } from "./PaginationBar";
import EditRegistroModal, { type EditTarget } from "./EditRegistroModal";

const EXPORT_BATCH_SIZE = 1000;

interface TabJornadaNormalProps {
  refreshKey: number;
}

export default function TabJornadaNormal({ refreshKey }: TabJornadaNormalProps) {
  const [fichadas, setFichadas] = useState<FichadaConDependencia[]>([]);
  const [displayFichadas, setDisplayFichadas] = useState<FichadaConDependencia[]>(
    [],
  );
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vista, setVista] = useState<"eventos" | "jornadas">("eventos");
  const [jornadas, setJornadas] = useState<Jornada[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [exportingAll, setExportingAll] = useState(false);

  const [searchDni, setSearchDni] = useState("");
  const [selectedDependencia, setSelectedDependencia] = useState("");
  const [selectedTipo, setSelectedTipo] = useState("");
  const [soloFueraDeRango, setSoloFueraDeRango] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [selectedFichada, setSelectedFichada] =
    useState<FichadaConDependencia | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const calcularDistanciaDependencia = useCallback(
    (
      fichada: FichadaConDependencia,
    ): { distancia: number; valida: boolean } | null => {
      if (
        !fichada.latitud ||
        !fichada.longitud ||
        !fichada.dependencia?.latitud ||
        !fichada.dependencia?.longitud
      ) {
        return null;
      }
      const distancia = calcularDistancia(
        fichada.latitud,
        fichada.longitud,
        fichada.dependencia.latitud,
        fichada.dependencia.longitud,
      );
      const radioPermitido = fichada.dependencia.radio_metros || 100;
      return {
        distancia: Math.round(distancia),
        valida: distancia <= radioPermitido,
      };
    },
    [],
  );

  const buildFilteredQuery = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (baseQuery: any) => {
      let query = baseQuery;
      if (searchDni) query = query.ilike("documento", `%${searchDni}%`);
      if (selectedDependencia)
        query = query.eq("dependencia_id", selectedDependencia);
      if (selectedTipo) query = query.eq("tipo", selectedTipo);
      if (fechaDesde) query = query.gte("fecha_hora", `${fechaDesde}T00:00:00`);
      if (fechaHasta)
        query = query.lte("fecha_hora", `${fechaHasta}T23:59:59.999`);
      return query;
    },
    [searchDni, selectedDependencia, selectedTipo, fechaDesde, fechaHasta],
  );

  const applyClientFilters = useCallback(
    (data: FichadaConDependencia[]) => {
      if (!soloFueraDeRango) return data;
      return data.filter((f) => {
        const distanciaInfo = calcularDistanciaDependencia(f);
        return distanciaInfo && !distanciaInfo.valida;
      });
    },
    [soloFueraDeRango, calcularDistanciaDependencia],
  );

  useEffect(() => {
    setDisplayFichadas(applyClientFilters(fichadas));
  }, [fichadas, applyClientFilters]);

  const attachDeps = (rows: Fichada[], deps: Dependencia[]) =>
    rows.map((fichada) => ({
      ...fichada,
      dependencia: deps.find((d) => d.id === fichada.dependencia_id),
    }));

  const fetchAllFiltered = async (
    depData: Dependencia[],
  ): Promise<FichadaConDependencia[]> => {
    const allRecords: FichadaConDependencia[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const baseQuery = supabase.from("fichadas").select("*");
      const { data, error: fetchError } = await buildFilteredQuery(baseQuery)
        .order("fecha_hora", { ascending: false })
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
    return allRecords;
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

      if (vista === "jornadas") {
        const all = await fetchAllFiltered(depData || []);
        setFichadas(all);
        setTotalCount(all.length);
        setJornadas(emparejarJornadas(all));
      } else {
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        const baseQuery = supabase.from("fichadas").select("*", { count: "exact" });
        const {
          data: fichadasData,
          error: fichadasError,
          count,
        } = await buildFilteredQuery(baseQuery)
          .order("fecha_hora", { ascending: false })
          .range(from, to);
        if (fichadasError) throw fichadasError;
        setTotalCount(count || 0);
        setFichadas(attachDeps(fichadasData || [], depData || []));
        setJornadas([]);
      }
    } catch (err) {
      logger.error("Error cargando datos:", err);
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
    vista,
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
    vista,
  ]);

  const exportToCSV = () => {
    downloadFile(
      generateCSVContent(displayFichadas),
      `fichadas_pagina_${currentPage}_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv;charset=utf-8;",
    );
  };

  const exportToTXT = () => {
    downloadFile(
      generateTXTContent(displayFichadas),
      `fichadas_pagina_${currentPage}_${new Date().toISOString().split("T")[0]}.txt`,
      "text/plain;charset=utf-8;",
    );
  };

  const exportAllCSV = async () => {
    setExportingAll(true);
    try {
      const allData = await fetchAllFiltered(dependencias);
      downloadFile(
        generateCSVContent(allData),
        `fichadas_completo_${new Date().toISOString().split("T")[0]}.csv`,
        "text/csv;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando CSV:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const exportAllTXT = async () => {
    setExportingAll(true);
    try {
      const allData = await fetchAllFiltered(dependencias);
      downloadFile(
        generateTXTContent(allData),
        `fichadas_completo_${new Date().toISOString().split("T")[0]}.txt`,
        "text/plain;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando TXT:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const exportJornadasCSV = async () => {
    setExportingAll(true);
    try {
      const allData =
        vista === "jornadas" ? fichadas : await fetchAllFiltered(dependencias);
      const paired = emparejarJornadas(allData);
      const headers = [
        "DNI",
        "Fecha",
        "Entrada",
        "Salida",
        "Horas",
        "Supera 7hs",
        "Estado",
      ];
      const rows = paired.map((j) => [
        j.documento,
        new Date(j.entrada.fecha_hora).toLocaleDateString("es-AR"),
        new Date(j.entrada.fecha_hora).toLocaleTimeString("es-AR", {
          hour12: false,
        }),
        j.salida
          ? new Date(j.salida.fecha_hora).toLocaleTimeString("es-AR", {
              hour12: false,
            })
          : "",
        j.horas != null ? formatHoras(j.horas) : "",
        j.excedeLimite ? "Sí" : "No",
        j.incompleta ? "Sin salida" : "Completa",
      ]);
      downloadFile(
        rowsToCSV(headers, rows),
        `jornadas_${new Date().toISOString().split("T")[0]}.csv`,
        "text/csv;charset=utf-8;",
      );
    } catch (err) {
      logger.error("Error exportando jornadas:", err);
      setError("Error al exportar. Intente nuevamente.");
    } finally {
      setExportingAll(false);
    }
  };

  const clearFilters = () => {
    setSearchDni("");
    setSelectedDependencia("");
    setSelectedTipo("");
    setSoloFueraDeRango(false);
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
      label: `TXT página (${displayFichadas.length})`,
      onClick: exportToTXT,
      disabled: displayFichadas.length === 0,
      variant: "primary",
      icon: "file",
    },
    {
      id: "csv-page",
      label: `CSV página (${displayFichadas.length})`,
      onClick: exportToCSV,
      disabled: displayFichadas.length === 0,
      variant: "green",
    },
  ];

  const allActions: ExportAction[] = [
    {
      id: "txt-all",
      label: `Exportar Todo TXT (${totalCount} registros)`,
      onClick: exportAllTXT,
      disabled: exportingAll || totalCount === 0,
      loading: exportingAll,
      variant: "dark",
      icon: "file",
    },
    {
      id: "csv-all",
      label: `Exportar Todo CSV (${totalCount} registros)`,
      onClick: exportAllCSV,
      disabled: exportingAll || totalCount === 0,
      loading: exportingAll,
      variant: "blue",
    },
    {
      id: "csv-jornadas",
      label: "CSV Jornadas",
      onClick: exportJornadasCSV,
      disabled: exportingAll,
      loading: exportingAll,
      variant: "green",
    },
  ];

  const displayedJornadas = soloFueraDeRango
    ? jornadas.filter((j) => {
        const entrada = {
          ...j.entrada,
          dependencia: dependencias.find(
            (d) => d.id === j.entrada.dependencia_id,
          ),
        };
        const info = calcularDistanciaDependencia(entrada);
        return info && !info.valida;
      })
    : jornadas;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
        <StatsCards
          totalFichadas={totalCount}
          entradas={displayFichadas.filter((f) => f.tipo === "entrada").length}
          salidas={displayFichadas.filter((f) => f.tipo === "salida").length}
          dependencias={dependencias.length}
        />
      </div>

      <FichadasFilters
        searchDni={searchDni}
        setSearchDni={setSearchDni}
        selectedDependencia={selectedDependencia}
        setSelectedDependencia={setSelectedDependencia}
        selectedTipo={selectedTipo}
        setSelectedTipo={setSelectedTipo}
        soloFueraDeRango={soloFueraDeRango}
        setSoloFueraDeRango={setSoloFueraDeRango}
        fechaDesde={fechaDesde}
        setFechaDesde={setFechaDesde}
        fechaHasta={fechaHasta}
        setFechaHasta={setFechaHasta}
        dependencias={dependencias}
        onClearFilters={clearFilters}
        onQuickFilter={setQuickFilter}
      />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <ExportButtons
            pageActions={vista === "eventos" ? pageActions : []}
            allActions={allActions}
            exportingAll={exportingAll}
          />
          <button
            type="button"
            onClick={() => setEditTarget({ kind: "normal" })}
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

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setVista("eventos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
              vista === "eventos"
                ? "bg-[#f0f9e6] border-[#b6c544] text-[#076633] dark:bg-[#b6c544]/20 dark:border-[#b6c544] dark:text-[#b6c544]"
                : "bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            <List className="w-4 h-4" />
            Eventos
          </button>
          <button
            type="button"
            onClick={() => setVista("jornadas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition ${
              vista === "jornadas"
                ? "bg-[#f0f9e6] border-[#b6c544] text-[#076633] dark:bg-[#b6c544]/20 dark:border-[#b6c544] dark:text-[#b6c544]"
                : "bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            Jornadas
          </button>
        </div>

        {vista === "eventos" ? (
          <FichadasTable
            fichadas={displayFichadas}
            loading={loading}
            onSelectFichada={setSelectedFichada}
            onEditFichada={(f) => setEditTarget({ kind: "normal", registro: f })}
          />
        ) : (
          <JornadasTable
            jornadas={displayedJornadas}
            dependencias={dependencias}
            loading={loading}
            onSelectEntrada={(j) =>
              setSelectedFichada({
                ...j.entrada,
                dependencia: dependencias.find(
                  (d) => d.id === j.entrada.dependencia_id,
                ),
              })
            }
            onSelectSalida={(j) => {
              if (!j.salida) return;
              setSelectedFichada({
                ...j.salida,
                dependencia: dependencias.find(
                  (d) => d.id === j.salida?.dependencia_id,
                ),
              });
            }}
          />
        )}

        {vista === "eventos" && !loading && (
          <PaginationBar
            currentPage={currentPage}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      <FichadaModal
        fichada={selectedFichada}
        onClose={() => setSelectedFichada(null)}
      />
      <EditRegistroModal
        target={editTarget}
        dependencias={dependencias}
        onClose={() => setEditTarget(null)}
        onSaved={loadData}
      />
    </>
  );
}
