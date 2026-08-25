"use client";

import { Clock, Calendar, Users, AlertCircle } from "lucide-react";
import StatCard from "./StatCard";

interface ExtrasStatsCardsProps {
  horasSemana: string;
  horasMes: string;
  empleadosMes: number;
  extrasAbiertas: number;
  onClickAbiertas?: () => void;
}

export default function ExtrasStatsCards({
  horasSemana,
  horasMes,
  empleadosMes,
  extrasAbiertas,
  onClickAbiertas,
}: ExtrasStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Clock}
        iconClassName="w-8 h-8 text-[#7bcbe2]"
        bgClassName="bg-[#7bcbe2]/15 dark:bg-gray-700"
        label="Horas extras (semana)"
        value={horasSemana}
      />
      <StatCard
        icon={Calendar}
        iconClassName="w-8 h-8 text-[#b6c544]"
        label="Horas extras (mes)"
        value={horasMes}
      />
      <StatCard
        icon={Users}
        iconClassName="w-8 h-8 text-purple-600"
        bgClassName="bg-purple-50 dark:bg-gray-700"
        label="Empleados con extras"
        value={empleadosMes}
      />
      <StatCard
        icon={AlertCircle}
        iconClassName="w-8 h-8 text-orange-600"
        bgClassName="bg-orange-50 dark:bg-gray-700"
        label="Fichadas extras abiertas"
        value={extrasAbiertas}
        onClick={onClickAbiertas}
      />
    </div>
  );
}
