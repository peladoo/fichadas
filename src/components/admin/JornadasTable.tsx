"use client";

import {
  Calendar,
  User,
  Building2,
  Eye,
  X,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { Jornada } from "@/lib/jornadas";
import { formatHoras, LIMITE_JORNADA_NORMAL_HORAS } from "@/lib/jornadas";
import type { Dependencia } from "@/lib/supabase";
import LoadingSpinner from "../LoadingSpinner";

interface JornadasTableProps {
  jornadas: Jornada[];
  dependencias: Dependencia[];
  loading: boolean;
  onSelectEntrada: (jornada: Jornada) => void;
  onSelectSalida?: (jornada: Jornada) => void;
}

const formatHora = (dateString: string) =>
  new Date(dateString).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatFecha = (dateString: string) =>
  new Date(dateString).toLocaleDateString("es-AR");

export default function JornadasTable({
  jornadas,
  dependencias,
  loading,
  onSelectEntrada,
  onSelectSalida,
}: JornadasTableProps) {
  if (loading) {
    return <LoadingSpinner message="Cargando jornadas..." />;
  }

  if (jornadas.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          No se encontraron jornadas
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {["DNI", "Fecha", "Entrada", "Salida", "Duración", "Dependencia", "Estado"].map(
              (h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {jornadas.map((jornada) => {
            const depId =
              jornada.entrada.dependencia_id || jornada.salida?.dependencia_id;
            const depNombre =
              dependencias.find((d) => d.id === depId)?.nombre || "N/A";
            return (
              <tr
                key={jornada.entrada.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {jornada.documento}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatFecha(jornada.entrada.fecha_hora)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onSelectEntrada(jornada)}
                    className="flex items-center gap-2 group"
                  >
                    {jornada.entrada.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={jornada.entrada.foto_url}
                        alt="Entrada"
                        className="w-10 h-10 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600 group-hover:border-[#b6c544]"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatHora(jornada.entrada.fecha_hora)}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {jornada.salida ? (
                    <button
                      onClick={() =>
                        onSelectSalida
                          ? onSelectSalida(jornada)
                          : onSelectEntrada(jornada)
                      }
                      className="flex items-center gap-2 group"
                    >
                      {jornada.salida.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={jornada.salida.foto_url}
                          alt="Salida"
                          className="w-10 h-10 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600 group-hover:border-[#b6c544]"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <X className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatHora(jornada.salida.fecha_hora)}
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      —
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatHoras(jornada.horas)}
                      </div>
                      {jornada.excedeLimite && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <div className="text-xs font-medium text-orange-700 dark:text-orange-400">
                            ⚠ Supera {LIMITE_JORNADA_NORMAL_HORAS}hs
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {depNombre}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {jornada.incompleta ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      Sin salida
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Eye className="w-3 h-3" /> Completa
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
