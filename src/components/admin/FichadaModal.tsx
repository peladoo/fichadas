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
  Download,
} from "lucide-react";
import type { Fichada, Dependencia } from "@/lib/supabase";
import FotoImg, { FotoDownloadLink } from "@/components/FotoImg";

interface FichadaConDependencia extends Fichada {
  dependencia?: Dependencia;
}

interface FichadaModalProps {
  fichada: FichadaConDependencia | null;
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

export default function FichadaModal({ fichada, onClose }: FichadaModalProps) {
  if (!fichada) return null;

  const { date, time } = formatDateTime(fichada.fecha_hora);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="bg-[#b6c544] p-2.5 rounded-xl">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Detalle de Fichada
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                DNI: {fichada.documento}
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
          {/* Información en tarjetas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#f0f9e6] dark:bg-[#b6c544]/20 p-4 rounded-2xl border border-[#b6c544]/30 dark:border-[#b6c544]/50">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-[#076633] dark:text-[#b6c544]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#b6c544] uppercase">
                  DNI
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {fichada.documento}
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                fichada.tipo === "entrada"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-500/30 dark:border-green-500/50"
                  : "bg-orange-50 dark:bg-orange-900/20 border-orange-500/30 dark:border-orange-500/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {fichada.tipo === "entrada" ? (
                  <LogIn className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <LogOut className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                )}
                <span
                  className={`text-xs font-medium uppercase ${
                    fichada.tipo === "entrada"
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}
                >
                  Tipo
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                {fichada.tipo}
              </p>
            </div>

            <div className="bg-[#7bcbe2]/10 dark:bg-[#7bcbe2]/20 p-4 rounded-2xl border border-[#7bcbe2]/30 dark:border-[#7bcbe2]/50">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-[#7bcbe2] dark:text-[#7bcbe2]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#7bcbe2] uppercase">
                  Dependencia
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {fichada.dependencia?.nombre || "N/A"}
              </p>
            </div>

            <div className="bg-[#b6c544]/10 dark:bg-[#b6c544]/20 p-4 rounded-2xl border border-[#b6c544]/30 dark:border-[#b6c544]/50">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[#076633] dark:text-[#b6c544]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#b6c544] uppercase">
                  Fecha
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {date}
              </p>
            </div>

            <div className="bg-[#fbd300]/10 dark:bg-[#fbd300]/20 p-4 rounded-2xl border border-[#fbd300]/30 dark:border-[#fbd300]/50">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-[#076633] dark:text-[#fbd300]" />
                <span className="text-xs font-medium text-[#076633] dark:text-[#fbd300] uppercase">
                  Hora
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {time}
              </p>
            </div>
          </div>

          {/* Foto con zoom y mejor presentación */}
          {fichada.foto_url && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Fotografía
                </h4>
                <FotoDownloadLink
                  path={fichada.foto_url!}
                  className="flex items-center gap-2 text-sm text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </FotoDownloadLink>
              </div>
              <div className="relative group overflow-hidden rounded-2xl border-4 border-gray-200 dark:border-gray-700 shadow-lg">
                <FotoImg
                  path={fichada.foto_url}
                  alt="Foto de fichada"
                  className="w-full h-auto object-contain max-h-[500px] transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>
          )}

          {/* Ubicación con mejor diseño */}
          {fichada.latitud && fichada.longitud && (
            <div className="bg-[#f0f9e6] dark:bg-gray-700 p-6 rounded-2xl border border-[#b6c544]/30 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#b6c544] p-3 rounded-xl">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Ubicación GPS
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {fichada.latitud.toFixed(6)},{" "}
                      {fichada.longitud.toFixed(6)}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${fichada.latitud},${fichada.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] text-white px-6 py-3 rounded-xl transition shadow-lg hover:shadow-xl font-medium"
                >
                  <MapPin className="w-5 h-5" />
                  Abrir en Google Maps
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
