"use client";

import { useEffect, useState } from "react";
import { supabase, type Dependencia } from "@/lib/supabase";
import { logger } from "@/lib/utils";
import { useMunicipio } from "@/components/MunicipioProvider";
import DependenciasManager from "./DependenciasManager";
import ImportRelojFisico from "./ImportRelojFisico";

interface TabConfiguracionProps {
  refreshKey: number;
}

export default function TabConfiguracion({ refreshKey }: TabConfiguracionProps) {
  const municipio = useMunicipio();
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);

  const loadDependencias = async () => {
    try {
      const { data, error } = await supabase
        .from("dependencias")
        .select("*")
        .eq("municipio_id", municipio.id)
        .order("nombre");
      if (error) throw error;
      setDependencias(data || []);
    } catch (err) {
      logger.error("Error cargando dependencias:", err);
    }
  };

  useEffect(() => {
    loadDependencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, municipio.id]);

  return (
    <div className="space-y-6">
      <DependenciasManager />
      <ImportRelojFisico
        dependencias={dependencias}
        onImportComplete={loadDependencias}
      />
    </div>
  );
}
