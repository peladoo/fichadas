"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PRIMARY_COLOR, type Municipio } from "@/lib/tenant";

interface MunicipioContextValue {
  municipio: Municipio;
}

const MunicipioContext = createContext<MunicipioContextValue | null>(null);

export function useMunicipio(): Municipio {
  const ctx = useContext(MunicipioContext);
  if (!ctx) {
    throw new Error("useMunicipio debe usarse dentro de MunicipioProvider");
  }
  return ctx.municipio;
}

export function MunicipioProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_municipio_by_slug",
        { slug_input: slug },
      );

      if (cancelled) return;

      if (rpcError) {
        setError(rpcError.message);
        setMunicipio(null);
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("Municipio no encontrado");
        setMunicipio(null);
        setLoading(false);
        return;
      }

      setMunicipio(row as Municipio);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!municipio) return;
    const color = municipio.color_primario || DEFAULT_PRIMARY_COLOR;
    document.documentElement.style.setProperty("--muni-primary", color);
    document.documentElement.style.setProperty("--color-primary", color);
    document.title = `Fichadas · ${municipio.nombre}`;
  }, [municipio]);

  const value = useMemo(
    () => (municipio ? { municipio } : null),
    [municipio],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b6c544] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando municipio...</p>
        </div>
      </div>
    );
  }

  if (error || !value) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Municipio no encontrado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            El enlace no corresponde a un municipio activo. Pedile a RRHH el QR
            o la URL correcta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MunicipioContext.Provider value={value}>
      {children}
    </MunicipioContext.Provider>
  );
}
