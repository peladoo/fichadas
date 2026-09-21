"use client";

import { useEffect, useState } from "react";
import { X, Save, Trash2, AlertCircle, Plus } from "lucide-react";
import {
  supabase,
  type Dependencia,
  type Fichada,
  type FichadaExtra,
  type TipoFichada,
} from "@/lib/supabase";
import { handleSupabaseError, isValidDNI, sanitizeDNI } from "@/lib/utils";
import { useMunicipio } from "@/components/MunicipioProvider";

export type EditTarget =
  | { kind: "normal"; registro?: Fichada }
  | { kind: "extra"; registro?: FichadaExtra };

interface EditRegistroModalProps {
  target: EditTarget | null;
  dependencias: Dependencia[];
  onClose: () => void;
  onSaved: () => void;
}

const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (val: string): string | null => {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

async function getEditorEmail(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email || "rrhh";
}

export default function EditRegistroModal({
  target,
  dependencias,
  onClose,
  onSaved,
}: EditRegistroModalProps) {
  const municipio = useMunicipio();
  const isNew = !target?.registro;
  const isExtra = target?.kind === "extra";

  const [documento, setDocumento] = useState("");
  const [tipo, setTipo] = useState<TipoFichada>("entrada");
  const [dependenciaId, setDependenciaId] = useState("");
  const [fechaHora, setFechaHora] = useState("");
  const [depEntrada, setDepEntrada] = useState("");
  const [depSalida, setDepSalida] = useState("");
  const [fechaEntrada, setFechaEntrada] = useState("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;
    setError("");
    setMotivo(target.registro?.motivo_edicion || "");
    if (target.kind === "normal") {
      const r = target.registro;
      setDocumento(r?.documento || "");
      setTipo(r?.tipo || "entrada");
      setDependenciaId(r?.dependencia_id || "");
      setFechaHora(toLocalInput(r?.fecha_hora) || toLocalInput(new Date().toISOString()));
    } else {
      const r = target.registro;
      setDocumento(r?.documento || "");
      setDepEntrada(r?.dependencia_id_entrada || "");
      setDepSalida(r?.dependencia_id_salida || "");
      setFechaEntrada(
        toLocalInput(r?.fecha_hora_entrada) ||
          toLocalInput(new Date().toISOString()),
      );
      setFechaSalida(toLocalInput(r?.fecha_hora_salida));
    }
  }, [target]);

  if (!target) return null;

  const extraAbierta = isExtra && !!target.registro && !target.registro.fecha_hora_salida;

  const handleDelete = async () => {
    if (!target.registro) return;
    if (
      !confirm(
        "¿Eliminar este registro? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const table = isExtra ? "fichadas_extras" : "fichadas";
      const { error: delError } = await supabase
        .from(table)
        .delete()
        .eq("id", target.registro.id);
      if (delError) throw delError;
      onSaved();
      onClose();
    } catch (err) {
      setError(handleSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError("");
    const dni = sanitizeDNI(documento);
    if (!isValidDNI(dni)) {
      setError("Ingresá un DNI válido (7 u 8 dígitos).");
      return;
    }

    setSaving(true);
    try {
      const email = await getEditorEmail();
      const audit = {
        editado_por: email,
        editado_at: new Date().toISOString(),
        motivo_edicion: motivo.trim() || null,
      };

      if (isExtra) {
        const entradaIso = fromLocalInput(fechaEntrada);
        const salidaIso = fromLocalInput(fechaSalida);
        if (!entradaIso) {
          setError("La fecha de entrada es obligatoria.");
          setSaving(false);
          return;
        }
        if (salidaIso && salidaIso <= entradaIso) {
          setError("La salida debe ser posterior a la entrada.");
          setSaving(false);
          return;
        }
        if (!depEntrada) {
          setError("Seleccioná la dependencia de entrada.");
          setSaving(false);
          return;
        }

        const payload = {
          documento: dni,
          dependencia_id_entrada: depEntrada,
          fecha_hora_entrada: entradaIso,
          dependencia_id_salida: depSalida || null,
          fecha_hora_salida: salidaIso,
          ...audit,
        };

        if (isNew) {
          const { error: insertError } = await supabase
            .from("fichadas_extras")
            .insert([{ ...payload, municipio_id: municipio.id, origen: "Manual_RRHH" }]);
          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from("fichadas_extras")
            .update(payload)
            .eq("id", target.registro!.id);
          if (updateError) throw updateError;
        }
      } else {
        const fechaIso = fromLocalInput(fechaHora);
        if (!fechaIso) {
          setError("La fecha y hora son obligatorias.");
          setSaving(false);
          return;
        }
        if (!dependenciaId) {
          setError("Seleccioná una dependencia.");
          setSaving(false);
          return;
        }
        const payload = {
          documento: dni,
          tipo,
          dependencia_id: dependenciaId,
          fecha_hora: fechaIso,
          ...audit,
        };
        if (isNew) {
          const { error: insertError } = await supabase
            .from("fichadas")
            .insert([{ ...payload, municipio_id: municipio.id, origen: "Manual_RRHH" }]);
          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from("fichadas")
            .update(payload)
            .eq("id", target.registro!.id);
          if (updateError) throw updateError;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(handleSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const title = isNew
    ? isExtra
      ? "Nueva fichada de horas extras"
      : "Nueva fichada"
    : isExtra
      ? "Editar horas extras"
      : "Editar fichada";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 rounded-xl"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {extraAbierta && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800 dark:text-orange-300">
                Esta fichada está abierta y bloquea al empleado para marcar
                cualquier otra entrada. Completá la hora de salida (o
                eliminá el registro) para desbloquearlo.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DNI
            </label>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(sanitizeDNI(e.target.value))}
              maxLength={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          {isExtra ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dependencia entrada
                </label>
                <select
                  value={depEntrada}
                  onChange={(e) => setDepEntrada(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Seleccionar</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha y hora de entrada
                </label>
                <input
                  type="datetime-local"
                  value={fechaEntrada}
                  onChange={(e) => setFechaEntrada(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dependencia salida
                </label>
                <select
                  value={depSalida}
                  onChange={(e) => setDepSalida(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Sin salida / misma</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha y hora de salida
                </label>
                <input
                  type="datetime-local"
                  value={fechaSalida}
                  onChange={(e) => setFechaSalida(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoFichada)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dependencia
                </label>
                <select
                  value={dependenciaId}
                  onChange={(e) => setDependenciaId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Seleccionar</option>
                  {dependencias.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha y hora
                </label>
                <input
                  type="datetime-local"
                  value={fechaHora}
                  onChange={(e) => setFechaHora(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo de la edición (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              placeholder="Ej: corrección de hora de salida"
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Verificá que el cambio no deje dos entradas o dos salidas seguidas
            para el empleado. RRHH puede corregir datos históricos aunque
            queden desparejos.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {target.registro ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm"
              >
                {isNew ? <Plus className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
