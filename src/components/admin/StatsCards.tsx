"use client";

import { LogIn, LogOut, Building2, User } from "lucide-react";
import StatCard from "./StatCard";

interface StatsCardsProps {
    totalFichadas: number;
    entradas: number;
    salidas: number;
    dependencias: number;
}

export default function StatsCards({
    totalFichadas,
    entradas,
    salidas,
    dependencias,
}: StatsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                icon={User}
                label="Total Fichadas"
                value={totalFichadas}
            />
            <StatCard
                icon={LogIn}
                iconClassName="w-8 h-8 text-green-600"
                bgClassName="bg-green-50 dark:bg-gray-700"
                label="Entradas"
                value={entradas}
            />
            <StatCard
                icon={LogOut}
                iconClassName="w-8 h-8 text-orange-600"
                bgClassName="bg-orange-50 dark:bg-gray-700"
                label="Salidas"
                value={salidas}
            />
            <StatCard
                icon={Building2}
                iconClassName="w-8 h-8 text-purple-600"
                bgClassName="bg-purple-50 dark:bg-gray-700"
                label="Dependencias"
                value={dependencias}
            />
        </div>
    );
}
