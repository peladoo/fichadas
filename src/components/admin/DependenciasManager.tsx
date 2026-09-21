"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Building2,
    Plus,
    Edit2,
    Trash2,
    MapPin,
    Save,
    X,
    Loader2,
    Navigation,
} from "lucide-react";
import { supabase, type Dependencia } from "@/lib/supabase";
import { handleSupabaseError, logger } from "@/lib/utils";
import { useMunicipio } from "@/components/MunicipioProvider";

interface DependenciaFormData {
    id?: string;
    nombre: string;
    codigo: string;
    latitud: number | null;
    longitud: number | null;
    radio_metros: number;
    direccion?: string;
}

const INITIAL_FORM: DependenciaFormData = {
    nombre: "",
    codigo: "",
    latitud: null,
    longitud: null,
    radio_metros: 100,
    direccion: "",
};

// Función para generar código desde el nombre
const generarCodigo = (nombre: string): string => {
    return nombre
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .replace(/[^a-z0-9]+/g, "-") // Reemplazar espacios y caracteres especiales
        .replace(/^-+|-+$/g, ""); // Quitar guiones al inicio/final
};

export default function DependenciasManager() {
    const municipio = useMunicipio();
    const [dependencias, setDependencias] = useState<Dependencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Estado del formulario
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<DependenciaFormData>(INITIAL_FORM);
    const [gpsLoading, setGpsLoading] = useState(false);

    // Ref para scroll al formulario
    const formRef = useRef<HTMLFormElement>(null);

    const loadDependencias = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from("dependencias")
                .select("*")
                .eq("municipio_id", municipio.id)
                .order("nombre");

            if (fetchError) throw fetchError;
            setDependencias(data || []);
        } catch (err) {
            logger.error("Error cargando dependencias:", err);
            setError(handleSupabaseError(err));
        } finally {
            setLoading(false);
        }
    }, [municipio.id]);

    useEffect(() => {
        loadDependencias();
    }, [loadDependencias]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;

        if (type === "number") {
            const numValue = value === "" ? null : parseFloat(value);
            setFormData((prev) => ({ ...prev, [name]: numValue }));
        } else {
            setFormData((prev) => {
                const updated = { ...prev, [name]: value };
                // Auto-generar código cuando cambia el nombre (solo si estamos creando)
                if (name === "nombre" && !editingId) {
                    updated.codigo = generarCodigo(value);
                }
                return updated;
            });
        }
    };

    const obtenerUbicacionActual = () => {
        if (!navigator.geolocation) {
            setError("Tu navegador no soporta geolocalización");
            return;
        }

        setGpsLoading(true);
        setError("");

        // Detectar plataforma
        const userAgent = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent) ||
            (userAgent.includes("mac") && "ontouchend" in document);
        const isAndroid = /android/i.test(userAgent);

        // Configuración optimizada por plataforma
        const geoOptions: PositionOptions = isIOS
            ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            : isAndroid
                ? { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                : { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

        // Función de éxito
        const onSuccess = (position: GeolocationPosition) => {
            setFormData((prev) => ({
                ...prev,
                latitud: position.coords.latitude,
                longitud: position.coords.longitude,
            }));
            setGpsLoading(false);
            setSuccess(`Ubicación obtenida (precisión: ${Math.round(position.coords.accuracy)}m)`);
            setTimeout(() => setSuccess(""), 5000);
        };

        // Función de error con reintento
        const onError = (err: GeolocationPositionError, isRetry: boolean = false) => {
            logger.error("Error obteniendo ubicación:", err.code, err.message);

            if (err.code === 1) {
                // PERMISSION_DENIED
                let msg = "🚫 Permisos de ubicación denegados. ";
                if (isIOS) {
                    msg += "Ve a Configuración > Privacidad > Servicios de ubicación > Safari y permite el acceso.";
                } else if (isAndroid) {
                    msg += "Toca el ícono de candado en la barra de direcciones y permite el acceso.";
                } else {
                    msg += "Habilita los permisos en tu navegador.";
                }
                setError(msg);
                setGpsLoading(false);
            } else if (err.code === 3 && !isRetry) {
                // TIMEOUT - reintentar con baja precisión
                logger.log("Timeout - reintentando con baja precisión...");
                navigator.geolocation.getCurrentPosition(
                    onSuccess,
                    (e) => onError(e, true),
                    { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 }
                );
            } else {
                setError("⚠️ No se pudo obtener la ubicación. Verifica que tengas GPS activado.");
                setGpsLoading(false);
            }
        };

        // En móviles, usar watchPosition para activar GPS más rápido
        if (isIOS || isAndroid) {
            let watchId: number | null = null;

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (watchId !== null) {
                        navigator.geolocation.clearWatch(watchId);
                    }
                    onSuccess(position);
                },
                (err) => {
                    if (watchId !== null) {
                        navigator.geolocation.clearWatch(watchId);
                    }
                    onError(err);
                },
                geoOptions
            );

            // Timeout de seguridad
            setTimeout(() => {
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                }
            }, 20000);
        } else {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        // Validaciones
        if (!formData.nombre.trim()) {
            setError("El nombre es obligatorio");
            return;
        }

        if (!formData.codigo.trim()) {
            setError("El código es obligatorio");
            return;
        }

        if (formData.latitud === null || formData.longitud === null) {
            setError("Las coordenadas GPS son obligatorias");
            return;
        }

        if (formData.radio_metros <= 0) {
            setError("El radio debe ser mayor a 0");
            return;
        }

        setSaving(true);

        try {
            const dataToSave = {
                municipio_id: municipio.id,
                nombre: formData.nombre.trim(),
                codigo: formData.codigo.trim(),
                latitud: formData.latitud,
                longitud: formData.longitud,
                radio_metros: formData.radio_metros,
                direccion: formData.direccion?.trim() || null,
            };

            if (editingId) {
                // Actualizar
                const { error: updateError } = await supabase
                    .from("dependencias")
                    .update(dataToSave)
                    .eq("id", editingId);

                if (updateError) throw updateError;
                setSuccess("Dependencia actualizada correctamente");
            } else {
                // Crear nueva
                const { error: insertError } = await supabase
                    .from("dependencias")
                    .insert([dataToSave]);

                if (insertError) throw insertError;
                setSuccess("Dependencia creada correctamente");
            }

            // Resetear formulario y recargar
            setFormData(INITIAL_FORM);
            setShowForm(false);
            setEditingId(null);
            await loadDependencias();
        } catch (err) {
            logger.error("Error guardando dependencia:", err);
            setError(handleSupabaseError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (dep: Dependencia) => {
        setFormData({
            id: dep.id,
            nombre: dep.nombre,
            codigo: dep.codigo || "",
            latitud: dep.latitud ?? null,
            longitud: dep.longitud ?? null,
            radio_metros: dep.radio_metros || 100,
            direccion: dep.direccion || "",
        });
        setEditingId(dep.id);
        setShowForm(true);
        setError("");
        setSuccess("");

        // Scroll al formulario para que el usuario lo vea
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Está seguro que desea eliminar la dependencia "${nombre}"?`)) {
            return;
        }

        try {
            setLoading(true);
            const { error: deleteError } = await supabase
                .from("dependencias")
                .delete()
                .eq("id", id);

            if (deleteError) throw deleteError;

            setSuccess("Dependencia eliminada correctamente");
            await loadDependencias();
        } catch (err) {
            logger.error("Error eliminando dependencia:", err);
            setError(handleSupabaseError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData(INITIAL_FORM);
        setShowForm(false);
        setEditingId(null);
        setError("");
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-500 p-2.5 rounded-xl">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Gestión de Dependencias
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Administrar lugares de fichadas
                        </p>
                    </div>
                </div>

                {!showForm && (
                    <button
                        onClick={() => {
                            setShowForm(true);
                            setFormData(INITIAL_FORM);
                            setEditingId(null);
                            // Scroll al formulario
                            setTimeout(() => {
                                formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }, 100);
                        }}
                        className="flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] text-white px-4 py-2 rounded-lg transition shadow-lg hover:shadow-xl font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Dependencia
                    </button>
                )}
            </div>

            {/* Mensajes */}
            {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            {success && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                    <p className="text-sm text-green-700">{success}</p>
                </div>
            )}

            {/* Formulario */}
            {showForm && (
                <form ref={formRef} onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {editingId ? "Editar Dependencia" : "Nueva Dependencia"}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nombre */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nombre de la Dependencia *
                            </label>
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleInputChange}
                                placeholder="Ej: CIC Municipal, Biblioteca, NIDO..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                                required
                            />
                        </div>

                        {/* Código */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Código *
                            </label>
                            <input
                                type="text"
                                name="codigo"
                                value={formData.codigo}
                                onChange={handleInputChange}
                                placeholder="Ej: cic-municipal, biblioteca..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                                required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Se genera automáticamente del nombre
                            </p>
                        </div>

                        {/* Dirección */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Dirección (opcional)
                            </label>
                            <input
                                type="text"
                                name="direccion"
                                value={formData.direccion || ""}
                                onChange={handleInputChange}
                                placeholder="Ej: Av. San Martín 123"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                            />
                        </div>

                        {/* Latitud */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Latitud *
                            </label>
                            <input
                                type="number"
                                name="latitud"
                                value={formData.latitud ?? ""}
                                onChange={handleInputChange}
                                step="any"
                                placeholder="-31.12345"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                                required
                            />
                        </div>

                        {/* Longitud */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Longitud *
                            </label>
                            <input
                                type="number"
                                name="longitud"
                                value={formData.longitud ?? ""}
                                onChange={handleInputChange}
                                step="any"
                                placeholder="-60.12345"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                                required
                            />
                        </div>

                        {/* Botón obtener ubicación */}
                        <div className="md:col-span-2">
                            <button
                                type="button"
                                onClick={obtenerUbicacionActual}
                                disabled={gpsLoading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition"
                            >
                                {gpsLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Obteniendo ubicación...
                                    </>
                                ) : (
                                    <>
                                        <Navigation className="w-4 h-4" />
                                        Obtener mi ubicación actual
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Párate en la ubicación de la dependencia y presiona este botón
                            </p>
                        </div>

                        {/* Radio */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Radio permitido (metros) *
                            </label>
                            <input
                                type="number"
                                name="radio_metros"
                                value={formData.radio_metros}
                                onChange={handleInputChange}
                                min="10"
                                max="1000"
                                placeholder="100"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#b6c544] focus:border-transparent dark:bg-gray-600 dark:text-white"
                                required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Distancia máxima desde la dependencia para poder fichar
                            </p>
                        </div>

                        {/* Preview del mapa */}
                        {formData.latitud && formData.longitud && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Vista previa
                                </label>
                                <a
                                    href={`https://www.google.com/maps?q=${formData.latitud},${formData.longitud}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                >
                                    <MapPin className="w-4 h-4" />
                                    Ver en Google Maps
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Botones del formulario */}
                    <div className="flex gap-3 mt-6 justify-end">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                        >
                            <X className="w-4 h-4" />
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-[#b6c544] hover:bg-[#9fb338] disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition shadow-lg font-medium"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {editingId ? "Actualizar" : "Guardar"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {/* Lista de dependencias */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[#b6c544]" />
                </div>
            ) : dependencias.length === 0 ? (
                <div className="text-center py-8">
                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                        No hay dependencias registradas
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Haz clic en &quot;Nueva Dependencia&quot; para agregar una
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Nombre
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Coordenadas
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Radio
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {dependencias.map((dep) => (
                                <tr key={dep.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-purple-500" />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {dep.nombre}
                                                </p>
                                                {dep.direccion && (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {dep.direccion}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {dep.latitud && dep.longitud ? (
                                            <a
                                                href={`https://www.google.com/maps?q=${dep.latitud},${dep.longitud}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                                            >
                                                <MapPin className="w-3 h-3" />
                                                {dep.latitud.toFixed(5)}, {dep.longitud.toFixed(5)}
                                            </a>
                                        ) : (
                                            <span className="text-gray-400 text-sm">Sin coordenadas</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-sm text-gray-900 dark:text-white">
                                            {dep.radio_metros || 100}m
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(dep)}
                                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(dep.id, dep.nombre)}
                                                className="text-red-600 hover:text-red-700 dark:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
