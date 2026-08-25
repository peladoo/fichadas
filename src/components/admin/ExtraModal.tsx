"use client";

import {
  User,
  Building2,
  MapPin,
  Eye,
  X,
  LogIn,
  LogOut,
  Download,
  Clock,
} from "lucide-react";
import type { FichadaExtraConDeps } from "@/lib/supabase";
import { evaluarExtra, formatHoras } from "@/lib/jornadas";

interface ExtraModalProps {
  extra: FichadaExtraConDeps | null;
  onClose: () => void;
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

export default function ExtraModal({ extra, onClose }: ExtraModalProps) {
  if (!extra) return null;

  const entrada = formatDateTime(extra.fecha_hora_entrada);
  const salida = extra.fecha_hora_salida
    ? formatDateTime(extra.fecha_hora_salida)
    : null;
  const evalExtra = evaluarExtra(extra);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="bg-[#7bcbe2] p-2.5 rounded-xl">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Detalle de horas extras
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                DNI: {extra.documento}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-xl transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#f0f9e6] dark:bg-[#b6c544]/20 p-4 rounded-2xl border border-[#b6c544]/30">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-[#076633] dark:text-[#b6c544]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#b6c544] uppercase">
                  DNI
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {extra.documento}
              </p>
            </div>

            <div className="bg-[#7bcbe2]/10 dark:bg-[#7bcbe2]/20 p-4 rounded-2xl border border-[#7bcbe2]/30">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#7bcbe2]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#7bcbe2] uppercase">
                  Horas
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {formatHoras(evalExtra.horas)}
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <LogIn className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-600 uppercase">
                  Entrada
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {entrada.date} {entrada.time}
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-500/30">
              <div className="flex items-center gap-2 mb-1">
                <LogOut className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-orange-600 uppercase">
                  Salida
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {salida ? `${salida.date} ${salida.time}` : "En curso"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#7bcbe2]/10 p-4 rounded-2xl border border-[#7bcbe2]/30">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-[#7bcbe2]" />
                <span className="text-xs font-medium uppercase">
                  Dependencia entrada
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {extra.dependenciaEntrada?.nombre || "N/A"}
              </p>
            </div>
            <div className="bg-[#7bcbe2]/10 p-4 rounded-2xl border border-[#7bcbe2]/30">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-[#7bcbe2]" />
                <span className="text-xs font-medium uppercase">
                  Dependencia salida
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {extra.dependenciaSalida?.nombre ||
                  (extra.fecha_hora_salida ? "N/A" : "—")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {extra.foto_url_entrada && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Foto entrada
                  </h4>
                  <a
                    href={extra.foto_url_entrada}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                </div>
                <div className="overflow-hidden rounded-2xl border-4 border-gray-200 dark:border-gray-700 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={extra.foto_url_entrada}
                    alt="Foto de entrada"
                    className="w-full h-auto object-contain max-h-[360px]"
                  />
                </div>
              </div>
            )}
            {extra.foto_url_salida && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Foto salida
                  </h4>
                  <a
                    href={extra.foto_url_salida}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                </div>
                <div className="overflow-hidden rounded-2xl border-4 border-gray-200 dark:border-gray-700 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={extra.foto_url_salida}
                    alt="Foto de salida"
                    className="w-full h-auto object-contain max-h-[360px]"
                  />
                </div>
              </div>
            )}
          </div>

          {(extra.latitud_entrada || extra.latitud_salida) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extra.latitud_entrada && extra.longitud_entrada && (
                <div className="bg-[#f0f9e6] dark:bg-gray-700 p-6 rounded-2xl border border-[#b6c544]/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-[#b6c544] p-3 rounded-xl">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        GPS entrada
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {Number(extra.latitud_entrada).toFixed(6)},{" "}
                        {Number(extra.longitud_entrada).toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${extra.latitud_entrada},${extra.longitud_entrada}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] text-white px-4 py-2 rounded-xl transition font-medium text-sm"
                  >
                    <MapPin className="w-4 h-4" />
                    Abrir en Google Maps
                  </a>
                </div>
              )}
              {extra.latitud_salida && extra.longitud_salida && (
                <div className="bg-[#f0f9e6] dark:bg-gray-700 p-6 rounded-2xl border border-[#b6c544]/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-[#b6c544] p-3 rounded-xl">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        GPS salida
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {Number(extra.latitud_salida).toFixed(6)},{" "}
                        {Number(extra.longitud_salida).toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${extra.latitud_salida},${extra.longitud_salida}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] text-white px-4 py-2 rounded-xl transition font-medium text-sm"
                  >
                    <MapPin className="w-4 h-4" />
                    Abrir en Google Maps
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
