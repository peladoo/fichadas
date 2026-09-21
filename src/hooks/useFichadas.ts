"use client";

import { useState, useCallback, useRef } from "react";
import { supabase, type Fichada } from "@/lib/supabase";
import { logger } from "@/lib/utils";

interface UseFichadasOptions {
    /** Tiempo mínimo entre fichadas en minutos (default: 5) */
    minutosMinimoEntreFichadas?: number;
}

interface FichadaReciente {
    fichada: Fichada | null;
    puedeRegistrar: boolean;
    tiempoRestante: number; // en segundos
    mensaje: string;
}

export function useFichadas(
    options: UseFichadasOptions & { municipioId: string },
) {
    const { minutosMinimoEntreFichadas = 5, municipioId } = options;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastCheckRef = useRef<{ dni: string; result: FichadaReciente } | null>(null);

    /**
     * Verifica si el usuario puede registrar una nueva fichada
     * basándose en el tiempo mínimo entre fichadas
     */
    const verificarFichadaReciente = useCallback(
        async (dni: string): Promise<FichadaReciente> => {
            // Si ya verificamos este DNI hace menos de 10 segundos, usar el cache
            if (lastCheckRef.current?.dni === dni) {
                const tiempoDesdeVerificacion =
                    (Date.now() - new Date(lastCheckRef.current.result.fichada?.fecha_hora || 0).getTime()) / 1000;

                if (tiempoDesdeVerificacion < 10) {
                    return lastCheckRef.current.result;
                }
            }

            setLoading(true);
            setError(null);

            try {
                const tiempoLimite = new Date(
                    Date.now() - minutosMinimoEntreFichadas * 60 * 1000
                ).toISOString();

                const { data, error: queryError } = await supabase
                    .from("fichadas")
                    .select("*")
                    .eq("municipio_id", municipioId)
                    .eq("documento", dni)
                    .gte("fecha_hora", tiempoLimite)
                    .order("fecha_hora", { ascending: false })
                    .limit(1);

                if (queryError) throw queryError;

                if (data && data.length > 0) {
                    const ultimaFichada = data[0];
                    const fechaUltima = new Date(ultimaFichada.fecha_hora);
                    const tiempoTranscurrido = (Date.now() - fechaUltima.getTime()) / 1000;
                    const tiempoRestante = Math.max(0, minutosMinimoEntreFichadas * 60 - tiempoTranscurrido);

                    const result: FichadaReciente = {
                        fichada: ultimaFichada,
                        puedeRegistrar: false,
                        tiempoRestante: Math.ceil(tiempoRestante),
                        mensaje: `Debes esperar ${Math.ceil(tiempoRestante / 60)} minutos para registrar otra fichada`,
                    };

                    lastCheckRef.current = { dni, result };
                    return result;
                }

                const result: FichadaReciente = {
                    fichada: null,
                    puedeRegistrar: true,
                    tiempoRestante: 0,
                    mensaje: "Puedes registrar tu fichada",
                };

                lastCheckRef.current = { dni, result };
                return result;
            } catch (err) {
                const mensaje = "Error al verificar fichadas recientes";
                logger.error(mensaje, err);
                setError(mensaje);

                // En caso de error, permitir fichar (mejor experiencia de usuario)
                return {
                    fichada: null,
                    puedeRegistrar: true,
                    tiempoRestante: 0,
                    mensaje: "No se pudo verificar, pero puedes continuar",
                };
            } finally {
                setLoading(false);
            }
        },
        [minutosMinimoEntreFichadas, municipioId]
    );

    /**
     * Formatea el tiempo restante en un string legible
     */
    const formatearTiempoRestante = useCallback((segundos: number): string => {
        if (segundos <= 0) return "";

        const minutos = Math.floor(segundos / 60);
        const segs = segundos % 60;

        if (minutos > 0) {
            return `${minutos}m ${segs}s`;
        }
        return `${segs}s`;
    }, []);

    return {
        verificarFichadaReciente,
        formatearTiempoRestante,
        loading,
        error,
        minutosMinimoEntreFichadas,
    };
}

export default useFichadas;
