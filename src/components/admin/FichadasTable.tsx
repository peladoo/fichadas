"use client";

import {
  Calendar,
  User,
  Building2,
  MapPin,
  Eye,
  X,
  LogIn,
  LogOut,
  MapPinOff,
  CheckCircle2,
  AlertCircle,
  Pencil,
  History,
} from "lucide-react";
import type { Fichada, Dependencia } from "@/lib/supabase";
import { calcularDistancia } from "@/lib/gpsConfig";
import LoadingSpinner from "../LoadingSpinner";
import FotoImg from "@/components/FotoImg";

interface FichadaConDependencia extends Fichada {
  dependencia?: Dependencia;
}

interface FichadasTableProps {
  fichadas: FichadaConDependencia[];
  loading: boolean;
  onSelectFichada: (fichada: FichadaConDependencia) => void;
  onEditFichada?: (fichada: FichadaConDependencia) => void;
}

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("es-AR"),
    time: date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
};

const calcularDistanciaDependencia = (
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
};

export default function FichadasTable({
  fichadas,
  loading,
  onSelectFichada,
  onEditFichada,
}: FichadasTableProps) {
  if (loading) {
    return <LoadingSpinner message="Cargando fichadas..." />;
  }

  if (fichadas.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          No se encontraron fichadas
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Foto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Fecha y Hora
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              DNI
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Dependencia
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              GPS
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {fichadas.map((fichada) => {
            const { date, time } = formatDateTime(fichada.fecha_hora);
            const distanciaInfo = calcularDistanciaDependencia(fichada);
            return (
              <tr
                key={fichada.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {/* Columna FOTO - MINIATURA */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {fichada.foto_url ? (
                    <button
                      onClick={() => onSelectFichada(fichada)}
                      className="group relative"
                    >
                      <FotoImg
                        path={fichada.foto_url}
                        alt="Miniatura"
                        className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600 group-hover:border-[#b6c544] transition-all cursor-pointer shadow-sm group-hover:shadow-md"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 rounded-lg transition-all">
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <X className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {date}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {time}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {fichada.documento}
                    </span>
                    {fichada.editado_at && (
                      <span
                        title={`Editado por ${fichada.editado_por || "RRHH"} el ${new Date(fichada.editado_at).toLocaleString("es-AR", { hour12: false })}`}
                      >
                        <History className="w-3.5 h-3.5 text-gray-400" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      fichada.tipo === "entrada"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}
                  >
                    {fichada.tipo === "entrada" ? (
                      <>
                        <LogIn className="w-3 h-3" /> Entrada
                      </>
                    ) : (
                      <>
                        <LogOut className="w-3 h-3" /> Salida
                      </>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {fichada.dependencia?.nombre || "N/A"}
                    </span>
                  </div>
                </td>

                {/* Columna GPS - VALIDACIÓN */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {distanciaInfo ? (
                    <div className="flex items-center gap-2">
                      {distanciaInfo.valida ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <div>
                            <div className="text-xs font-medium text-green-700 dark:text-green-400">
                              ✓ Válida
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {distanciaInfo.distancia}m
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <div>
                            <div className="text-xs font-medium text-orange-700 dark:text-orange-400">
                              ⚠ Fuera de rango
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {distanciaInfo.distancia}m
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : fichada.latitud && fichada.longitud ? (
                    <div className="flex items-center gap-2">
                      <MapPinOff className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Sin validar
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MapPinOff className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Sin GPS
                      </span>
                    </div>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {fichada.latitud && fichada.longitud && (
                      <a
                        href={`https://www.google.com/maps?q=${fichada.latitud},${fichada.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                        title="Ver en Google Maps"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => onSelectFichada(fichada)}
                      className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {onEditFichada && (
                      <button
                        onClick={() => onEditFichada(fichada)}
                        className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                        title="Editar registro"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
