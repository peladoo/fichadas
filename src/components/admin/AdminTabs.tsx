"use client";

import { Clock, FileText, Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";

export type AdminTabId = "normal" | "extras" | "config";

interface AdminTabsProps {
  value: AdminTabId;
  onChange: (tab: AdminTabId) => void;
}

const TABS: { id: AdminTabId; label: string; icon: typeof FileText }[] = [
  { id: "normal", label: "Jornada Normal", icon: FileText },
  { id: "extras", label: "Horas Extras", icon: Clock },
  { id: "config", label: "Configuración", icon: Settings },
];

export function parseAdminTab(raw: string | null): AdminTabId {
  if (raw === "extras" || raw === "config" || raw === "normal") return raw;
  return "normal";
}

export default function AdminTabs({ value, onChange }: AdminTabsProps) {
  const handleChange = (tab: AdminTabId) => {
    onChange(tab);
    const url = new URL(window.location.href);
    if (tab === "normal") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl mb-6">
      <nav className="flex flex-wrap gap-1 px-2" aria-label="Pestañas">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition ${
                active
                  ? "border-[#b6c544] text-[#076633] dark:text-[#b6c544]"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function useInitialAdminTab(): AdminTabId {
  const params = useSearchParams();
  return parseAdminTab(params.get("tab"));
}
