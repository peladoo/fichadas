"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/version";
import { FileText, RefreshCw, ArrowLeft, LogOut } from "lucide-react";
import AdminTabs, { type AdminTabId, useInitialAdminTab } from "./admin/AdminTabs";
import TabJornadaNormal from "./admin/TabJornadaNormal";
import TabHorasExtras from "./admin/TabHorasExtras";
import TabConfiguracion from "./admin/TabConfiguracion";

export default function AdminPanel() {
  const initialTab = useInitialAdminTab();
  const [tab, setTab] = useState<AdminTabId>(initialTab);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogout = async () => {
    if (confirm("¿Está seguro que desea cerrar sesión?")) {
      await supabase.auth.signOut();
      window.location.href = "/admin";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al registro de fichadas
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="bg-[#b6c544] p-3 rounded-full">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Panel de Administración
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Gestión de fichadas - Recursos Humanos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] text-white px-4 py-2 rounded-lg transition shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>

        <AdminTabs value={tab} onChange={setTab} />

        {tab === "normal" && <TabJornadaNormal refreshKey={refreshKey} />}
        {tab === "extras" && <TabHorasExtras refreshKey={refreshKey} />}
        {tab === "config" && <TabConfiguracion refreshKey={refreshKey} />}

        <div className="text-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Municipalidad de San Benito · v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
