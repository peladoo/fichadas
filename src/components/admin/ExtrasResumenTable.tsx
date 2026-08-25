"use client";

import { User, Clock, AlertCircle } from "lucide-react";
import { formatHoras } from "@/lib/jornadas";

export interface ExtraResumenRow {
  documento: string;
  cantidad: number;
  totalHoras: number;
}

interface ExtrasResumenTableProps {
  resumen: ExtraResumenRow[];
}

export default function ExtrasResumenTable({ resumen }: ExtrasResumenTableProps) {
  if (resumen.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          No hay horas extras cerradas en el rango filtrado
        </p>
      </div>
    );
  }

  const totalGeneral = resumen.reduce((acc, r) => acc + r.totalHoras, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {["DNI", "Fichadas", "Total horas"].map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {resumen.map((row) => (
            <tr
              key={row.documento}
              className="hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <td className="px-6 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {row.documento}
                  </span>
                </div>
              </td>
              <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                {row.cantidad}
              </td>
              <td className="px-6 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatHoras(row.totalHoras)}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({row.totalHoras.toFixed(2)} h)
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
              Total
            </td>
            <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
              {resumen.reduce((acc, r) => acc + r.cantidad, 0)}
            </td>
            <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">
              {formatHoras(totalGeneral)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
