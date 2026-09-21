"use client";

import { CheckCircle, LogIn, LogOut, Building2, ArrowLeft, Clock } from "lucide-react";
import { TipoFichada, TipoJornada } from "@/lib/supabase";

interface FichadaSuccessProps {
    tipoFichada: TipoFichada;
    tipoJornada?: TipoJornada;
    dependenciaNombre: string;
    municipioNombre?: string;
    onVolver: () => void;
}

export default function FichadaSuccess({
    tipoFichada,
    tipoJornada = "normal",
    dependenciaNombre,
    municipioNombre,
    onVolver,
}: FichadaSuccessProps) {
    const isEntrada = tipoFichada === "entrada";
    const isExtra = tipoJornada === "extra";
    const tipoLabel = isExtra
        ? isEntrada
            ? "Entrada de horas extras"
            : "Salida de horas extras"
        : isEntrada
            ? "Entrada"
            : "Salida";
    const fechaHora = new Date().toLocaleString("es-AR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 flex items-center justify-center">
            <div className="max-w-lg w-full">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
                    {/* Icono de éxito animado */}
                    <div className="flex justify-center">
                        <div
                            className={`p-5 rounded-full ${isEntrada
                                ? "bg-green-100 dark:bg-green-900/30"
                                : "bg-orange-100 dark:bg-orange-900/30"
                                } animate-pulse`}
                        >
                            <CheckCircle
                                className={`w-16 h-16 ${isEntrada
                                    ? "text-green-500 dark:text-green-400"
                                    : "text-orange-500 dark:text-orange-400"
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Título de éxito */}
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            ¡Fichada Registrada!
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {isExtra
                                ? `${tipoLabel} registrada`
                                : "Tu fichada fue procesada exitosamente"}
                        </p>
                    </div>

                    {/* Detalles de la fichada */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 space-y-4">
                        {/* Tipo de fichada */}
                        <div className="flex items-center gap-3">
                            <div
                                className={`p-2 rounded-lg ${isEntrada
                                    ? "bg-green-100 dark:bg-green-900/30"
                                    : "bg-orange-100 dark:bg-orange-900/30"
                                    }`}
                            >
                                {isEntrada ? (
                                    <LogIn
                                        className={`w-5 h-5 ${isEntrada
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-orange-600 dark:text-orange-400"
                                            }`}
                                    />
                                ) : (
                                    <LogOut className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Tipo de fichada
                                </p>
                                <p
                                    className={`font-semibold ${isEntrada
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-orange-600 dark:text-orange-400"
                                        }`}
                                >
                                    {tipoLabel}
                                </p>
                            </div>
                        </div>

                        {/* Dependencia */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Establecimiento
                                </p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                    {dependenciaNombre}
                                </p>
                            </div>
                        </div>

                        {/* Fecha y hora */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Fecha y hora
                                </p>
                                <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                    {fechaHora}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Mensaje de confirmación */}
                    <div
                        className={`text-center p-4 rounded-lg ${isEntrada
                            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                            : "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                            }`}
                    >
                        <p
                            className={`text-sm font-medium ${isEntrada
                                ? "text-green-700 dark:text-green-300"
                                : "text-orange-700 dark:text-orange-300"
                                }`}
                        >
                            {isEntrada
                                ? "🎉 ¡Que tengas un excelente día!"
                                : "👋 ¡Hasta pronto!"}
                        </p>
                    </div>

                    {/* Botón para volver */}
                    <button
                        onClick={onVolver}
                        className="w-full bg-[#b6c544] hover:bg-[#9fb338] text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Volver al formulario
                    </button>
                </div>

                {/* Footer */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {municipioNombre || "Sistema de fichadas"}
                    </p>
                </div>
            </div>
        </div>
    );
}
