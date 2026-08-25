"use client";

import { Download, FileText, Loader2 } from "lucide-react";

export type ExportButtonVariant = "primary" | "green" | "dark" | "blue";

export interface ExportAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ExportButtonVariant;
  icon?: "download" | "file";
}

interface ExportButtonsProps {
  pageActions: ExportAction[];
  allActions: ExportAction[];
  exportingAll?: boolean;
}

const variantClass: Record<ExportButtonVariant, string> = {
  primary:
    "bg-[#b6c544] hover:bg-[#9fb338] disabled:bg-gray-400 text-white",
  green: "bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white",
  dark: "bg-[#076633] hover:bg-[#054d26] disabled:bg-gray-400 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white",
};

function ActionButton({ action }: { action: ExportAction }) {
  const Icon = action.icon === "file" ? FileText : Download;
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      className={`flex items-center gap-2 ${variantClass[action.variant || "primary"]} px-4 py-2 rounded-lg transition shadow-lg hover:shadow-xl text-sm`}
      title={action.label}
    >
      {action.loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      {action.label}
    </button>
  );
}

export default function ExportButtons({
  pageActions,
  allActions,
  exportingAll,
}: ExportButtonsProps) {
  return (
    <div>
      {pageActions.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Exportar página actual
          </h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {pageActions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        </>
      )}

      {allActions.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Exportar todos los registros filtrados
          </h3>
          <div className="flex flex-wrap gap-3">
            {allActions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </div>
        </>
      )}

      {exportingAll && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Descargando todos los registros, por favor espere...
        </p>
      )}
    </div>
  );
}
