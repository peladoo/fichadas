"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Camera from "./Camera";
import FichadaSuccess from "./FichadaSuccess";
import {
  supabase,
  type FichadaInsert,
  type FichadaExtraInsert,
  type FichadaExtraCierre,
  type Dependencia,
  type TipoFichada,
  type TipoJornada,
} from "@/lib/supabase";
import {
  validarUbicacionParaFichar,
  validarUbicacionParaDependencia,
  encontrarDependenciaMasCercanaDeLista,
} from "@/lib/gpsConfig";
import {
  sanitizeDNI,
  isValidDNI,
  handleSupabaseError,
  compressImage,
  logger,
} from "@/lib/utils";
import {
  getEstadoEmpleado,
  validarAccion,
  type EstadoEmpleado,
} from "@/lib/jornadas";
import { APP_VERSION } from "@/lib/version";
import { MapPin, AlertCircle, AlertTriangle, Building2, LogIn, LogOut, Clock } from "lucide-react";

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

interface FichadaExitosa {
  tipoFichada: TipoFichada;
  tipoJornada: TipoJornada;
  dependenciaNombre: string;
}

// Etapas de progreso durante el submit para dar feedback claro al usuario
type SubmitStage = "comprimiendo" | "subiendo" | "guardando";

// ---------------------------------------------------------------------------
// Constantes de GPS por plataforma (definidas fuera del componente para
// evitar recrearlas en cada render)
// ---------------------------------------------------------------------------

const GPS_OPTIONS_HIGH_IOS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
const GPS_OPTIONS_HIGH_ANDROID: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};
const GPS_OPTIONS_HIGH_DESKTOP: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 0,
};
// Fallback de baja precisión cuando hay timeout en el primer intento
const GPS_OPTIONS_LOW: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20000,
  maximumAge: 30000,
};

// ---------------------------------------------------------------------------
// Detección de plataforma (ejecutada una sola vez fuera del componente)
// ---------------------------------------------------------------------------

const detectDevice = () => {
  if (typeof window === "undefined")
    return { isIOS: false, isAndroid: false, isMobile: false };
  const ua = navigator.userAgent.toLowerCase();
  return {
    isIOS:
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("mac") && "ontouchend" in document),
    isAndroid: /android/i.test(ua),
    isMobile:
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ),
  };
};

const DEVICE_INFO = detectDevice();

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function FichadasForm() {
  const [documento, setDocumento] = useState("");
  // photoBlob almacena la imagen YA comprimida (WebP) lista para subir
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  // photoPreview es la ObjectURL del blob comprimido; se revoca al reemplazar
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // Etapa actual del proceso de envío para mensajes granulares
  const [submitStage, setSubmitStage] = useState<SubmitStage | null>(null);
  const [fichadaExitosa, setFichadaExitosa] = useState<FichadaExitosa | null>(
    null,
  );
  const [error, setError] = useState("");
  const [alerta, setAlerta] = useState("");
  const [estadoEmpleado, setEstadoEmpleado] = useState<EstadoEmpleado | null>(
    null,
  );
  const [dependencia, setDependencia] = useState<Dependencia | null>(null);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [tipoFichada, setTipoFichada] = useState<TipoFichada>("entrada");
  const [tipoJornada, setTipoJornada] = useState<TipoJornada>("normal");
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationValidation, setLocationValidation] = useState<{
    permitido: boolean;
    mensaje: string;
  } | null>(null);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);

  // Ref para bloquear doble submit: más confiable que useState porque no
  // depende del ciclo de render para actualizarse sincrónicamente
  const isSubmittingRef = useRef(false);

  // Ref para rastrear si el componente sigue montado y cancelar operaciones
  // asíncronas cuando se desmonte (evita setState en componente desmontado)
  const isMountedRef = useRef(true);

  // Ref para cancelar el retry de GPS si se desmonta antes del timeout
  const gpsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancelar timer de retry GPS al desmontar
      if (gpsRetryTimerRef.current !== null) {
        clearTimeout(gpsRetryTimerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // GPS — solicitarUbicacion
  // Usa únicamente getCurrentPosition (sin watchPosition ni setInterval):
  // - Menor consumo de batería
  // - Sin múltiples callbacks simultáneos
  // - Retry controlado: intento de alta precisión → fallback baja precisión
  // ---------------------------------------------------------------------------

  const solicitarUbicacion = useCallback(() => {
    if (!navigator.geolocation) {
      logger.error("Geolocalización no disponible");
      setError(
        "⚠️ Tu navegador no soporta geolocalización. Por favor usa Chrome, Firefox o Safari.",
      );
      setGpsPermissionDenied(true);
      return;
    }

    const platform = DEVICE_INFO.isIOS
      ? "iOS"
      : DEVICE_INFO.isAndroid
        ? "Android"
        : "Desktop";
    logger.log(`🔄 Solicitando ubicación GPS... (${platform})`);

    const geoOptionsHigh = DEVICE_INFO.isIOS
      ? GPS_OPTIONS_HIGH_IOS
      : DEVICE_INFO.isAndroid
        ? GPS_OPTIONS_HIGH_ANDROID
        : GPS_OPTIONS_HIGH_DESKTOP;

    // Handler de éxito compartido entre intento principal y retry
    const onSuccess = (position: GeolocationPosition) => {
      if (!isMountedRef.current) return;
      logger.log("✅ Ubicación obtenida:", {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setGpsPermissionDenied(false);
      setError("");
    };

    // Handler de error del retry de baja precisión (no reintenta más)
    const onErrorFallback = (err: GeolocationPositionError) => {
      if (!isMountedRef.current) return;
      logger.error("❌ Error GPS (fallback):", err.message);
      setGpsPermissionDenied(true);
      setError(
        "⚠️ No se pudo obtener tu ubicación. Verifica que tengas GPS activado y presiona 'Reintentar GPS' para volver a intentar.",
      );
    };

    // Handler de error del intento principal
    const onError = (err: GeolocationPositionError) => {
      if (!isMountedRef.current) return;
      logger.error("❌ Error GPS:", err.message, "Código:", err.code);

      if (err.code === 1) {
        // PERMISSION_DENIED — no tiene sentido reintentar
        let errorMsg =
          "🚫 Necesitamos acceso a tu ubicación para verificar que estés en una dependencia municipal. ";
        if (DEVICE_INFO.isIOS) {
          errorMsg +=
            "Ve a Configuración > Privacidad > Servicios de ubicación > Safari y selecciona 'Mientras se usa la app'.";
        } else if (DEVICE_INFO.isAndroid) {
          errorMsg +=
            "Toca el ícono de candado/info en la barra de direcciones y permite el acceso a la ubicación.";
        } else {
          errorMsg +=
            "Por favor, habilita los permisos de ubicación en tu navegador y presiona 'Reintentar GPS'.";
        }
        setGpsPermissionDenied(true);
        setError(errorMsg);
      } else if (err.code === 3) {
        // TIMEOUT — reintentar una vez con baja precisión para no quedar bloqueado
        logger.log("⏱️ Timeout GPS — reintentando con baja precisión...");
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onErrorFallback,
          GPS_OPTIONS_LOW,
        );
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        let errorMsg = "⚠️ No se pudo determinar tu ubicación. ";
        if (DEVICE_INFO.isIOS) {
          errorMsg +=
            "Asegúrate de tener los Servicios de ubicación activados en Configuración > Privacidad.";
        } else if (DEVICE_INFO.isAndroid) {
          errorMsg +=
            "Activa el GPS desde la barra de notificaciones o ve a Configuración > Ubicación.";
        } else {
          errorMsg += "Verifica que tengas GPS activado.";
        }
        setGpsPermissionDenied(true);
        setError(errorMsg);
      } else {
        setGpsPermissionDenied(true);
        setError(
          "⚠️ No se pudo obtener tu ubicación. Verifica que tengas GPS activado y presiona 'Reintentar GPS' para volver a intentar.",
        );
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      onError,
      geoOptionsHigh,
    );
  }, []); // sin dependencias: usa solo refs y constantes externas

  // ---------------------------------------------------------------------------
  // Efecto inicial: cargar dependencias + solicitar GPS una vez
  // No hay setInterval — si el GPS falla, el usuario usa el botón "Reintentar"
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadDependencias();

    // Pequeño delay en iOS para asegurar que el contexto de página esté listo
    const delay = DEVICE_INFO.isIOS ? 500 : 0;
    gpsRetryTimerRef.current = setTimeout(solicitarUbicacion, delay);

    return () => {
      if (gpsRetryTimerRef.current !== null) {
        clearTimeout(gpsRetryTimerRef.current);
      }
    };
  }, [solicitarUbicacion]);

  // Auto-seleccionar la dependencia más cercana cuando llega la ubicación
  useEffect(() => {
    if (!location || dependencias.length === 0 || dependencia) return;

    const dependenciaCercana = encontrarDependenciaMasCercanaDeLista(
      location,
      dependencias,
    );
    if (dependenciaCercana) {
      const dependenciaCompleta = dependencias.find(
        (d) => d.id === dependenciaCercana.id,
      );
      if (dependenciaCompleta) {
        setDependencia(dependenciaCompleta);
        logger.log(
          `📍 Auto-seleccionada: ${dependenciaCercana.nombre} (${dependenciaCercana.distancia}m)`,
        );
      }
    }
  }, [location, dependencias]); // dependencia excluida intencionalmente para evitar ciclos

  // Aviso si hay jornada abierta: no bloquea, solo informa
  useEffect(() => {
    const dniSanitizado = sanitizeDNI(documento);
    if (!isValidDNI(dniSanitizado)) {
      setEstadoEmpleado(null);
      setAlerta("");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const estado = await getEstadoEmpleado(dniSanitizado);
        if (!cancelled && isMountedRef.current) {
          setEstadoEmpleado(estado);
        }
      } catch (err) {
        logger.error("Error consultando estado del empleado:", err);
        if (!cancelled && isMountedRef.current) {
          setEstadoEmpleado(null);
          setAlerta("");
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [documento]);

  useEffect(() => {
    if (!estadoEmpleado) {
      setAlerta("");
      return;
    }
    const validacion = validarAccion(estadoEmpleado, tipoJornada, tipoFichada);
    setAlerta(validacion.alerta || "");
  }, [estadoEmpleado, tipoJornada, tipoFichada]);

  // Validar ubicación cuando cambie la dependencia seleccionada o la ubicación
  useEffect(() => {
    if (!location) {
      setLocationValidation(null);
      return;
    }
    if (dependencia) {
      const validation = validarUbicacionParaDependencia(location, {
        nombre: dependencia.nombre,
        latitud: dependencia.latitud,
        longitud: dependencia.longitud,
        radio_metros: dependencia.radio_metros,
      });
      setLocationValidation(validation);
      logger.log("📍 Validación GPS (dependencia):", validation);
    } else {
      const validation = validarUbicacionParaFichar(location);
      setLocationValidation(validation);
      logger.log("📍 Validación GPS (general):", validation);
    }
  }, [location, dependencia]);

  // ---------------------------------------------------------------------------
  // Carga de dependencias desde Supabase
  // ---------------------------------------------------------------------------

  const loadDependencias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("dependencias")
        .select("*")
        .order("nombre");
      if (error) throw error;
      if (isMountedRef.current) setDependencias(data || []);
    } catch (err) {
      logger.error("Error cargando dependencias:", err);
      if (isMountedRef.current) setError(handleSupabaseError(err));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Captura de foto — comprime a WebP 640px antes de almacenar en estado
  // Revoca la ObjectURL anterior para evitar memory leaks
  // ---------------------------------------------------------------------------

  const handlePhotoCapture = useCallback(
    async (blob: Blob) => {
      try {
        // Revocar URL previa si existe para liberar memoria
        if (photoPreview) {
          URL.revokeObjectURL(photoPreview);
        }

        // Comprimir la imagen capturada: WebP, máx 640px, calidad 0.7
        // La función compressImage ya maneja fallback a JPEG si WebP no está disponible
        const comprimida = await compressImage(blob, 640, 0.7);

        if (!isMountedRef.current) return;

        const previewUrl = URL.createObjectURL(comprimida);
        setPhotoBlob(comprimida);
        setPhotoPreview(previewUrl);
      } catch (err) {
        logger.error("Error comprimiendo imagen:", err);
        // Si la compresión falla, usar el blob original como fallback
        if (isMountedRef.current) {
          if (photoPreview) URL.revokeObjectURL(photoPreview);
          const previewUrl = URL.createObjectURL(blob);
          setPhotoBlob(blob);
          setPhotoPreview(previewUrl);
        }
      }
    },
    [photoPreview], // depende de photoPreview para revocar la URL anterior
  );

  // Limpiar foto y revocar ObjectURL al descartar
  const handleDiscardPhoto = useCallback(() => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoBlob(null);
    setPhotoPreview("");
  }, [photoPreview]);

  // Cleanup final de la ObjectURL al desmontar el componente
  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Submit del formulario
  // Protegido contra doble submit con isSubmittingRef (síncrono) + loading (UI)
  // La imagen ya viene comprimida desde handlePhotoCapture
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Bloqueo doble submit: la ref es síncrona, no depende del ciclo de render
      if (isSubmittingRef.current) return;

      const dniSanitizado = sanitizeDNI(documento);
      if (!isValidDNI(dniSanitizado)) {
        setError("Por favor ingresá un DNI válido (7 u 8 dígitos)");
        return;
      }
      if (!dependencia) {
        setError("Por favor seleccioná una dependencia");
        return;
      }
      if (!photoBlob) {
        setError("Por favor tomá una foto");
        return;
      }
      if (!location) {
        setError("Esperando ubicación GPS...");
        return;
      }

      // Marcar como en progreso antes de cualquier await
      isSubmittingRef.current = true;
      setLoading(true);
      setError("");

      try {
        const estado = await getEstadoEmpleado(dniSanitizado);
        const validacion = validarAccion(estado, tipoJornada, tipoFichada);
        if (validacion.alerta) {
          setAlerta(validacion.alerta);
        }

        // Extra + salida sin sesión: se abre una entrada extra en vez de trabar
        const extraComoEntrada =
          tipoJornada === "extra" &&
          tipoFichada === "salida" &&
          !estado.extraAbierta;

        // --- Etapa 1: la compresión ya se hizo al capturar, aquí solo informamos ---
        setSubmitStage("subiendo");

        // La imagen ya está comprimida en WebP; usar extensión correcta
        const isWebP = photoBlob.type === "image/webp";
        const ext = isWebP ? "webp" : "jpg";
        const contentType = isWebP ? "image/webp" : "image/jpeg";
        const tipoPersistido: TipoFichada = extraComoEntrada
          ? "entrada"
          : tipoFichada;
        const jornadaTag =
          tipoJornada === "extra" ? `extra-${tipoPersistido}` : tipoPersistido;
        const fileName = `${Date.now()}-${dniSanitizado}-${jornadaTag}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("fotos-fichadas")
          .upload(fileName, photoBlob, {
            contentType,
            // upsert: false por defecto — evita sobreescritura accidental
          });

        if (uploadError) throw uploadError;

        // Obtener URL pública (operación local, sin round-trip a la red)
        const { data: urlData } = supabase.storage
          .from("fotos-fichadas")
          .getPublicUrl(fileName);

        // --- Etapa 2: insertar registro en la base de datos ---
        setSubmitStage("guardando");

        if (tipoJornada === "extra") {
          if (tipoPersistido === "entrada") {
            const extraData: FichadaExtraInsert = {
              documento: dniSanitizado,
              dependencia_id_entrada: dependencia.id,
              foto_url_entrada: urlData.publicUrl,
              latitud_entrada: location.lat,
              longitud_entrada: location.lng,
            };
            logger.log("Enviando fichada extra (entrada):", extraData);
            const { error: insertError } = await supabase
              .from("fichadas_extras")
              .insert([extraData]);
            if (insertError) throw insertError;
          } else {
            const extraAbierta = estado.extraAbierta;
            const cierre: FichadaExtraCierre = {
              dependencia_id_salida: dependencia.id,
              foto_url_salida: urlData.publicUrl,
              latitud_salida: location.lat,
              longitud_salida: location.lng,
              fecha_hora_salida: new Date().toISOString(),
            };
            logger.log("Cerrando fichada extra:", cierre);
            const { data: updated, error: updateError } = await supabase
              .from("fichadas_extras")
              .update(cierre)
              .eq("id", extraAbierta!.id)
              .is("fecha_hora_salida", null)
              .select("id");
            if (updateError) throw updateError;
            if (!updated || updated.length === 0) {
              setError(
                "La fichada de horas extras ya fue cerrada. Actualizá e intentá de nuevo.",
              );
              return;
            }
          }
        } else {
          const fichadaData: FichadaInsert = {
            dependencia_id: dependencia.id,
            documento: dniSanitizado,
            tipo: tipoPersistido,
            foto_url: urlData.publicUrl,
            latitud: location.lat,
            longitud: location.lng,
          };

          logger.log("Enviando fichada:", fichadaData);

          const { error: insertError } = await supabase
            .from("fichadas")
            .insert([fichadaData]);

          if (insertError) throw insertError;
        }

        // Éxito: revocar ObjectURL y limpiar estado
        if (photoPreview) URL.revokeObjectURL(photoPreview);

        setFichadaExitosa({
          tipoFichada: tipoPersistido,
          tipoJornada,
          dependenciaNombre: dependencia.nombre,
        });

        // Resetear formulario para la próxima fichada
        setDocumento("");
        setPhotoBlob(null);
        setPhotoPreview("");
        setDependencia(null);
        setTipoFichada("entrada");
        setTipoJornada("normal");
        setAlerta("");
        setEstadoEmpleado(null);
      } catch (err) {
        setError(handleSupabaseError(err));
        logger.error("Error al registrar fichada:", err);
      } finally {
        // Siempre desbloquear, incluso en error
        isSubmittingRef.current = false;
        setLoading(false);
        setSubmitStage(null);
      }
    },
    [documento, dependencia, photoBlob, photoPreview, location, tipoFichada, tipoJornada],
  );

  // ---------------------------------------------------------------------------
  // Mensaje del botón de submit según etapa
  // ---------------------------------------------------------------------------

  const submitButtonLabel = () => {
    if (!loading) return "Registrar Fichada";
    switch (submitStage) {
      case "comprimiendo":
        return "Comprimiendo foto...";
      case "subiendo":
        return "Subiendo foto...";
      case "guardando":
        return "Guardando fichada...";
      default:
        return "Registrando fichada...";
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (fichadaExitosa) {
    return (
      <FichadaSuccess
        tipoFichada={fichadaExitosa.tipoFichada}
        tipoJornada={fichadaExitosa.tipoJornada}
        dependenciaNombre={fichadaExitosa.dependenciaNombre}
        onVolver={() => setFichadaExitosa(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-[#b6c544] p-3 rounded-full">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Registro de Fichada
            </h1>
            {dependencia && (
              <p className="text-gray-600 dark:text-gray-400">
                {dependencia.nombre}
              </p>
            )}
          </div>

          {/* Aviso de jornada abierta: no bloquea el registro */}
          {alerta && (
            <div className="bg-amber-50 border border-amber-400 text-amber-800 dark:bg-amber-900/20 dark:border-amber-500 dark:text-amber-300 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <span>{alerta}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Documento */}
            <div>
              <label
                htmlFor="documento"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Documento (DNI)
              </label>
              <input
                type="text"
                id="documento"
                value={documento}
                onChange={(e) => setDocumento(sanitizeDNI(e.target.value))}
                placeholder="Ingrese su DNI"
                maxLength={8}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={loading}
                required
              />
            </div>

            {/* Selector de tipo de jornada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Tipo de jornada
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipoJornada("normal")}
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 px-4 py-4 rounded-lg border-2 transition ${
                    tipoJornada === "normal"
                      ? "bg-[#f0f9e6] border-[#b6c544] text-[#076633] dark:bg-[#b6c544]/20 dark:border-[#b6c544] dark:text-[#b6c544]"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="font-semibold">Jornada Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoJornada("extra")}
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 px-4 py-4 rounded-lg border-2 transition ${
                    tipoJornada === "extra"
                      ? "bg-[#7bcbe2]/15 border-[#7bcbe2] text-[#076633] dark:bg-[#7bcbe2]/20 dark:border-[#7bcbe2] dark:text-[#7bcbe2]"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">Horas Extras</span>
                </button>
              </div>
            </div>

            {/* Selector de Tipo de Fichada */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Tipo de Fichada
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipoFichada("entrada")}
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 px-4 py-4 rounded-lg border-2 transition ${
                    tipoFichada === "entrada"
                      ? "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <LogIn className="w-5 h-5" />
                  <span className="font-semibold">Entrada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoFichada("salida")}
                  disabled={loading}
                  className={`flex items-center justify-center gap-2 px-4 py-4 rounded-lg border-2 transition ${
                    tipoFichada === "salida"
                      ? "bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20 dark:border-orange-500 dark:text-orange-400"
                      : "bg-white border-gray-300 text-gray-700 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-semibold">Salida</span>
                </button>
              </div>
            </div>

            {/* Selector de Dependencia */}
            <div>
              <label
                htmlFor="dependencia"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Dependencia
              </label>
              <select
                id="dependencia"
                value={dependencia?.id || ""}
                onChange={(e) => {
                  const selected = dependencias.find(
                    (d) => d.id === e.target.value,
                  );
                  setDependencia(selected || null);
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={loading}
                required
              >
                <option value="">Seleccione una dependencia</option>
                {dependencias.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Cámara */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Foto (obligatorio)
              </label>
              {!photoPreview ? (
                <Camera onCapture={handlePhotoCapture} disabled={loading} />
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Foto capturada"
                    className="w-full rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleDiscardPhoto}
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                    disabled={loading}
                  >
                    Tomar otra foto
                  </button>
                </div>
              )}
            </div>

            {/* Location Status */}
            <div className="space-y-3">
              {location && locationValidation?.permitido ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-3 flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-700 dark:text-green-300 font-medium text-sm">
                      ✓ Ubicación válida
                    </p>
                    <p className="text-green-600 dark:text-green-400 text-xs mt-1">
                      {locationValidation.mensaje}
                    </p>
                  </div>
                </div>
              ) : location &&
                locationValidation &&
                !locationValidation.permitido ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-yellow-700 dark:text-yellow-300 font-medium text-sm">
                      ⚠️ Advertencia: Estás fuera del rango
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                      {locationValidation.mensaje}
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2 italic">
                      Podés fichar igual, pero tu ubicación quedará registrada.
                    </p>
                  </div>
                </div>
              ) : gpsPermissionDenied ? (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-orange-700 dark:text-orange-300 font-medium text-sm">
                        ⚠️ Permisos de ubicación necesarios
                      </p>
                      <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                        Debes habilitar la ubicación para fichar. Asegúrate de:
                      </p>
                      <ul className="text-orange-600 dark:text-orange-400 text-xs mt-2 ml-4 list-disc space-y-1">
                        <li>Tener GPS/ubicación activado en tu dispositivo</li>
                        <li>
                          Dar permisos de ubicación a este sitio en el navegador
                        </li>
                        <li>
                          Estar en BIBLIOTECA, CIC o NIDO (a menos de 100m)
                        </li>
                      </ul>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGpsPermissionDenied(false);
                      setError("");
                      solicitarUbicacion();
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <MapPin className="w-4 h-4" />
                    Reintentar GPS
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-blue-700 dark:text-blue-300 text-sm">
                    Obteniendo ubicación GPS...
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                loading || !dependencia || !documento || !photoBlob || !location
              }
              className="w-full bg-[#b6c544] hover:bg-[#9fb338] disabled:bg-gray-400 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {submitButtonLabel()}
                </>
              ) : (
                "Registrar Fichada"
              )}
            </button>

            {/* Indicador de qué falta */}
            {(!documento || !dependencia || !photoBlob || !location) && (
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                <div className="text-center">
                  {!documento && "⚠ Falta: DNI • "}
                  {!dependencia && "⚠ Falta: Dependencia • "}
                  {!photoBlob && "⚠ Falta: Foto • "}
                  {!location && "⚠ Falta: Ubicación GPS"}
                </div>
                {gpsPermissionDenied && (
                  <div className="text-orange-600 dark:text-orange-400 font-medium text-center bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-200 dark:border-orange-800">
                    🔒 Habilita los permisos de ubicación para continuar
                  </div>
                )}
              </div>
            )}

            {/* Advertencia adicional si está fuera de rango pero puede fichar */}
            {documento &&
              dependencia &&
              photoBlob &&
              location &&
              locationValidation &&
              !locationValidation.permitido && (
                <div className="text-sm text-yellow-700 dark:text-yellow-300 text-center bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  ⚠️ <strong>Importante:</strong> Tu ubicación actual quedará
                  registrada aunque estés fuera del rango permitido.
                </div>
              )}
          </form>

          {dependencias.length === 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <AlertCircle className="w-5 h-5 mx-auto mb-2" />
              Cargando dependencias...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Municipalidad de San Benito
          </p>
          <a
            href="/admin"
            className="inline-block text-sm text-[#076633] hover:text-[#054d26] dark:text-[#b6c544] hover:underline font-medium"
          >
            Acceso Recursos Humanos →
          </a>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
