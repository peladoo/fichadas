"use client";

import { useEffect, useState } from "react";
import { supabase, type Dependencia } from "@/lib/supabase";
import { logger } from "@/lib/utils";
import DependenciasManager from "./DependenciasManager";
import ImportRelojFisico from "./ImportRelojFisico";

interface TabConfiguracionProps {
  refreshKey: number;
}

export default function TabConfiguracion({ refreshKey }: TabConfiguracionProps) {
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);

  const loadDependencias = async () => {
    try {
      const { data, error } = await supabase
        .from("dependencias")
        .select("*")
        .order("nombre");
      if (error) throw error;
      setDependencias(data || []);
    } catch (err) {
      logger.error("Error cargando dependencias:", err);
    }
  };

  useEffect(() => {
    loadDependencias();
  }, [refreshKey]);

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
