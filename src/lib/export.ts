import type { FichadaConDependencia } from "@/lib/supabase";

export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string,
) => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const rowsToCSV = (headers: string[], rows: string[][]): string => {
  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
};

export const generateCSVContent = (data: FichadaConDependencia[]): string => {
  const headers = ["Fecha y Hora", "DNI", "Tipo", "Dependencia", "Ubicación"];
  const rows = data.map((f) => [
    new Date(f.fecha_hora).toLocaleString("es-AR", { hour12: false }),
    f.documento,
    f.tipo.charAt(0).toUpperCase() + f.tipo.slice(1),
    f.dependencia?.nombre || "N/A",
    f.latitud && f.longitud ? `${f.latitud}, ${f.longitud}` : "No disponible",
  ]);
  return rowsToCSV(headers, rows);
};

const formatRelojLine = (fechaHora: string, documento: string): string => {
  const fecha = new Date(fechaHora);
  const dia = fecha.getDate().toString().padStart(2, "0");
  const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
  const anio = fecha.getFullYear().toString();
  const hora = fecha.getHours().toString().padStart(2, "0");
  const minutos = fecha.getMinutes().toString().padStart(2, "0");
  const dni = documento.padEnd(9, " ");
  return `${dni} ${dia} ${mes} ${anio} ${hora} ${minutos}`;
};

export const generateTXTContent = (data: FichadaConDependencia[]): string => {
  return data.map((f) => formatRelojLine(f.fecha_hora, f.documento)).join("\n");
};

export const generateRelojLine = formatRelojLine;
