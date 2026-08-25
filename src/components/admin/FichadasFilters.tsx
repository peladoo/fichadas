"use client";

import {
    Search,
    Calendar,
    Building2,
    Filter,
    X,
    MapPinOff,
} from "lucide-react";
import type { Dependencia } from "@/lib/supabase";

export interface TipoFilterOption {
    value: string;
    label: string;
}

interface FichadasFiltersProps {
    searchDni: string;
    setSearchDni: (value: string) => void;
    selectedDependencia: string;
    setSelectedDependencia: (value: string) => void;
    selectedTipo: string;
    setSelectedTipo: (value: string) => void;
    tipoOptions?: TipoFilterOption[];
    tipoLabel?: string;
    soloFueraDeRango: boolean;
    setSoloFueraDeRango: (value: boolean) => void;
    showGpsFilter?: boolean;
    fechaDesde: string;
    setFechaDesde: (value: string) => void;
    fechaHasta: string;
    setFechaHasta: (value: string) => void;
    dependencias: Dependencia[];
    onClearFilters: () => void;
    onQuickFilter: (type: "hoy" | "semana" | "mes") => void;
}

const DEFAULT_TIPO_OPTIONS: TipoFilterOption[] = [
    { value: "", label: "Todos" },
    { value: "entrada", label: "Entrada" },
    { value: "salida", label: "Salida" },
];

export default function FichadasFilters({
    searchDni,
    setSearchDni,
    selectedDependencia,
    setSelectedDependencia,
    selectedTipo,
    setSelectedTipo,
    tipoOptions = DEFAULT_TIPO_OPTIONS,
    tipoLabel = "Tipo",
    soloFueraDeRango,
    setSoloFueraDeRango,
    showGpsFilter = true,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    dependencias,
    onClearFilters,
    onQuickFilter,
}: FichadasFiltersProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Filtros
                    </h2>
                </div>
                <button
                    onClick={onClearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition font-medium"
                >
                    <X className="w-4 h-4" />
                    Limpiar filtros
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Search className="w-4 h-4 inline mr-1" />
                        DNI
                    </label>
                    <input
                        type="text"
                        value={searchDni}
                        onChange={(e) =>
                            setSearchDni(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Buscar por DNI"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Dependencia
                    </label>
                    <select
                        value={selectedDependencia}
                        onChange={(e) => setSelectedDependencia(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                        <option value="">Todas</option>
                        {dependencias.map((dep) => (
                            <option key={dep.id} value={dep.id}>
                                {dep.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Filter className="w-4 h-4 inline mr-1" />
                        {tipoLabel}
                    </label>
                    <select
                        value={selectedTipo}
                        onChange={(e) => setSelectedTipo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                        {tipoOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Desde
                    </label>
                    <input
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Hasta
                    </label>
                    <input
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    onClick={() => onQuickFilter("hoy")}
                    className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition"
                >
                    Hoy
                </button>
                <button
                    onClick={() => onQuickFilter("semana")}
                    className="px-3 py-1.5 text-sm bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg transition"
                >
                    Esta semana
                </button>
                <button
                    onClick={() => onQuickFilter("mes")}
                    className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg transition"
                >
                    Este mes
                </button>
            </div>

            {showGpsFilter && (
                <div className="mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={soloFueraDeRango}
                            onChange={(e) => setSoloFueraDeRango(e.target.checked)}
                            className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <MapPinOff className="w-4 h-4 text-orange-600" />
                            Solo fichadas fuera de rango GPS
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
}
