"use client";

import {
  Calendar,
  User,
  Building2,
  MapPin,
  Eye,
  X,
  MapPinOff,
  CheckCircle2,
  AlertCircle,
  Pencil,
  History,
  Clock,
} from "lucide-react";
import type { Dependencia, FichadaExtraConDeps } from "@/lib/supabase";
import { calcularDistancia } from "@/lib/gpsConfig";
import {
  evaluarExtra,
  formatHoras,
  LIMITE_FICHADA_EXTRA_HORAS,
} from "@/lib/jornadas";
import LoadingSpinner from "../LoadingSpinner";

interface ExtrasTableProps {
  extras: FichadaExtraConDeps[];
  loading: boolean;
  onSelectExtra: (extra: FichadaExtraConDeps) => void;
  onEditExtra?: (extra: FichadaExtraConDeps) => void;
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

const gpsInfo = (
  lat?: number | null,
  lng?: number | null,
  dependencia?: Dependencia,
): { distancia: number; valida: boolean } | null => {
  if (!lat || !lng || !dependencia?.latitud || !dependencia?.longitud) {
    return null;
  }
  const distancia = calcularDistancia(
    lat,
    lng,
    dependencia.latitud,
    dependencia.longitud,
  );
  return {
    distancia: Math.round(distancia),
    valida: distancia <= (dependencia.radio_metros || 100),
  };
};

function GpsChip({
  info,
  hasCoords,
}: {
  info: { distancia: number; valida: boolean } | null;
  hasCoords: boolean;
}) {
  if (info) {
    return info.valida ? (
      <div className="flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-xs text-green-700 dark:text-green-400">
          {info.distancia}m
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
        <span className="text-xs text-orange-700 dark:text-orange-400">
          {info.distancia}m
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <MapPinOff className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-xs text-gray-500">
        {hasCoords ? "Sin validar" : "Sin GPS"}
      </span>
    </div>
  );
}

export default function ExtrasTable({
  extras,
  loading,
  onSelectExtra,
  onEditExtra,
}: ExtrasTableProps) {
  if (loading) {
    return <LoadingSpinner message="Cargando horas extras..." />;
  }

  if (extras.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          No se encontraron fichadas de horas extras
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {[
              "DNI",
              "Fecha",
              "Entrada",
              "Salida",
              "Horas",
              "Dependencia",
              "Acciones",
            ].map((h) => (
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
          {extras.map((extra) => {
            const entrada = formatDateTime(extra.fecha_hora_entrada);
            const salida = extra.fecha_hora_salida
              ? formatDateTime(extra.fecha_hora_salida)
              : null;
            const evalExtra = evaluarExtra(extra);
            const gpsEntrada = gpsInfo(
              extra.latitud_entrada,
              extra.longitud_entrada,
              extra.dependenciaEntrada,
            );
            const gpsSalida = gpsInfo(
              extra.latitud_salida,
              extra.longitud_salida,
              extra.dependenciaSalida,
            );
            const depLabel =
              extra.dependenciaEntrada?.nombre ||
              extra.dependenciaSalida?.nombre ||
              "N/A";
            const depSalidaDiff =
              extra.dependenciaSalida &&
              extra.dependencia_id_salida !== extra.dependencia_id_entrada
                ? extra.dependenciaSalida.nombre
                : null;

            return (
              <tr
                key={extra.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {extra.documento}
                    </span>
                    {extra.editado_at && (
                      <span
                        title={`Editado por ${extra.editado_por || "RRHH"} el ${new Date(extra.editado_at).toLocaleString("es-AR", { hour12: false })}`}
                      >
                        <History className="w-3.5 h-3.5 text-gray-400" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {entrada.date}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {extra.foto_url_entrada ? (
                      <button onClick={() => onSelectExtra(extra)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={extra.foto_url_entrada}
                          alt="Entrada"
                          className="w-10 h-10 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                        />
                      </button>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <X className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {entrada.time}
                      </div>
                      <GpsChip
                        info={gpsEntrada}
                        hasCoords={!!(extra.latitud_entrada && extra.longitud_entrada)}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {salida ? (
                    <div className="flex items-center gap-2">
                      {extra.foto_url_salida ? (
                        <button onClick={() => onSelectExtra(extra)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={extra.foto_url_salida}
                            alt="Salida"
                            className="w-10 h-10 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <X className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {salida.time}
                        </div>
                        <GpsChip
                          info={gpsSalida}
                          hasCoords={!!(extra.latitud_salida && extra.longitud_salida)}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      En curso
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatHoras(evalExtra.horas)}
                        {evalExtra.abierta && (
                          <span className="ml-1 text-xs text-gray-500">
                            (transcurridas)
                          </span>
                        )}
                      </div>
                      {evalExtra.requiereRevision ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <div className="text-xs font-medium text-red-700 dark:text-red-400">
                            ⚠ Revisar
                          </div>
                        </div>
                      ) : evalExtra.excedeLimite ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <div className="text-xs font-medium text-orange-700 dark:text-orange-400">
                            ⚠ Supera {LIMITE_FICHADA_EXTRA_HORAS}hs
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {depLabel}
                      </span>
                      {depSalidaDiff && (
                        <div className="text-xs text-gray-500">
                          Salida: {depSalidaDiff}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {extra.latitud_entrada && extra.longitud_entrada && (
                      <a
                        href={`https://www.google.com/maps?q=${extra.latitud_entrada},${extra.longitud_entrada}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544]"
                        title="Ver entrada en Maps"
                      >
                        <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => onSelectExtra(extra)}
                      className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544]"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {onEditExtra && (
                      <button
                        onClick={() => onEditExtra(extra)}
                        className="text-[#076633] hover:text-[#054d26] dark:text-[#b6c544]"
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
