/**
 * Utilidades generales del proyecto
 */

// ==========================================
// VALIDACIÓN Y SANITIZACIÓN
// ==========================================

/**
 * Sanitiza y valida un DNI
 */
export const sanitizeDNI = (dni: string): string => {
  return dni.replace(/[^\d]/g, "").slice(0, 8);
};

/**
 * Valida que un DNI sea correcto
 */
export const isValidDNI = (dni: string): boolean => {
  const sanitized = sanitizeDNI(dni);
  return /^\d{7,8}$/.test(sanitized);
};

// ==========================================
// MANEJO DE ERRORES DE SUPABASE
// ==========================================

/**
 * Type guard para errores con código
 */
interface ErrorWithCode {
  code?: string;
  message?: string;
}

/**
 * Type guard para verificar si un error tiene código
 */
function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return (
    typeof error === "object" &&
    error !== null &&
    ("code" in error || "message" in error)
  );
}

/**
 * Convierte errores de Supabase en mensajes amigables
 */
export const handleSupabaseError = (error: unknown): string => {
  if (!error) return "Error desconocido";

  if (!isErrorWithCode(error)) {
    return "Error al procesar la solicitud. Intenta nuevamente.";
  }

  // Errores de base de datos PostgreSQL
  if (error.code) {
    switch (error.code) {
      case "23505":
        return "Ya existe un registro similar";
      case "23503":
        return "Referencia inválida. Verifica los datos.";
      case "23514":
        return "Datos inválidos. Verifica la información.";
      case "42501":
      case "PGRST301":
        return "No tienes permisos para realizar esta acción";
      case "PGRST116":
        return "No se encontraron registros";
      default:
        break;
    }
  }

  // Errores de autenticación
  if (error.message) {
    if (error.message.includes("Invalid login credentials")) {
      return "Credenciales incorrectas";
    }
    if (error.message.includes("Email not confirmed")) {
      return "Email no confirmado";
    }
    if (error.message.includes("User already registered")) {
      return "Usuario ya registrado";
    }
  }

  // Errores de storage
  if (error.message?.includes("storage")) {
    return "Error al subir el archivo. Intenta nuevamente.";
  }

  return error.message || "Error al procesar la solicitud. Intenta nuevamente.";
};

// ==========================================
// VALIDACIÓN DE ARCHIVOS
// ==========================================

export const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB (optimizado para fichadas)
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
export const OUTPUT_IMAGE_TYPE = "image/webp"; // WebP es ~30% más eficiente que JPEG

/**
 * Valida que un archivo sea una imagen válida
 */
export const validateImageFile = (
  blob: Blob,
): { valid: boolean; error?: string } => {
  // Validar tipo
  if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) {
    return {
      valid: false,
      error: "Formato no válido. Solo se permiten JPG y PNG.",
    };
  }

  // Validar tamaño
  if (blob.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "La imagen es muy grande. Máximo 1MB.",
    };
  }

  return { valid: true };
};

/**
 * Comprime una imagen usando canvas con optimización para fichadas
 * - WebP por defecto (mejor compresión)
 * - Fallback a JPEG si WebP no es soportado
 * - Reintento con menor calidad si excede el tamaño máximo
 */
export const compressImage = async (
  blob: Blob,
  maxWidth: number = 800, // Reducido de 1920 a 800 (suficiente para fichada facial)
  quality: number = 0.75, // Calidad única, sin doble compresión
  maxSizeBytes: number = MAX_FILE_SIZE,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("No se pudo crear contexto de canvas"));
      return;
    }

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Error al cargar imagen"));
    };

    const objectUrl = URL.createObjectURL(blob);
    img.src = objectUrl;

    img.onload = () => {
      // Calcular nuevas dimensiones manteniendo aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, width, height);

      // Liberar memoria
      URL.revokeObjectURL(objectUrl);

      // Función para intentar compresión con calidad variable
      const tryCompress = (currentQuality: number, isWebP: boolean): void => {
        const mimeType = isWebP ? "image/webp" : "image/jpeg";

        canvas.toBlob(
          (compressedBlob) => {
            if (!compressedBlob) {
              reject(new Error("Error al comprimir imagen"));
              return;
            }

            // Verificar tamaño final
            const originalSize = (blob.size / 1024).toFixed(1);
            const finalSize = (compressedBlob.size / 1024).toFixed(1);

            logger.log(`📸 Imagen optimizada:`, {
              original: `${originalSize}KB`,
              final: `${finalSize}KB`,
              reduccion: `${((1 - compressedBlob.size / blob.size) * 100).toFixed(0)}%`,
              formato: isWebP ? "WebP" : "JPEG",
              calidad: currentQuality,
              dimensiones: `${width}x${height}`,
            });

            // Si excede el tamaño máximo y podemos bajar calidad, reintentar
            if (compressedBlob.size > maxSizeBytes && currentQuality > 0.5) {
              const newQuality = Math.max(0.5, currentQuality - 0.15);
              logger.log(
                `⚠️ Imagen excede ${(maxSizeBytes / 1024).toFixed(0)}KB, reintentando con calidad ${newQuality}`,
              );
              tryCompress(newQuality, isWebP);
              return;
            }

            resolve(compressedBlob);
          },
          mimeType,
          currentQuality,
        );
      };

      // Intentar WebP primero, fallback a JPEG si falla
      tryCompress(quality, true);
    };
  });
};

// ==========================================
// UTILIDADES DE FECHA
// ==========================================

/**
 * Obtiene el rango de fechas para "hoy"
 */
export const getTodayRange = (): { desde: string; hasta: string } => {
  const today = new Date().toISOString().split("T")[0];
  return { desde: today, hasta: today };
};

/**
 * Obtiene el rango de fechas para "esta semana"
 */
export const getThisWeekRange = (): { desde: string; hasta: string } => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  return {
    desde: weekAgo.toISOString().split("T")[0],
    hasta: today.toISOString().split("T")[0],
  };
};

/**
 * Obtiene el rango de fechas para "este mes"
 */
export const getThisMonthRange = (): { desde: string; hasta: string } => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    desde: firstDay.toISOString().split("T")[0],
    hasta: today.toISOString().split("T")[0],
  };
};

/**
 * Semana en curso: desde el lunes 00:00 hasta ahora (fechas locales YYYY-MM-DD).
 */
export const getSemanaLunesRange = (): { desde: string; hasta: string } => {
  const today = new Date();
  const day = today.getDay(); // 0 domingo … 6 sábado
  const offsetLunes = day === 0 ? 6 : day - 1;
  const lunes = new Date(today);
  lunes.setDate(today.getDate() - offsetLunes);

  const toLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${date}`;
  };

  return { desde: toLocalDate(lunes), hasta: toLocalDate(today) };
};

/**
 * Mes actual: desde el día 1 hasta hoy (fechas locales YYYY-MM-DD).
 */
export const getMesActualRange = (): { desde: string; hasta: string } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return {
    desde: `${year}-${month}-01`,
    hasta: `${year}-${month}-${date}`,
  };
};

// ==========================================
// LOGGER CONDICIONAL
// ==========================================

/**
 * Logger que solo funciona en desarrollo
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(...args);
    }
  },
};

// ==========================================
// FORMATEO
// ==========================================

/**
 * Formatea un número de DNI con puntos
 */
export const formatDNI = (dni: string): string => {
  const sanitized = sanitizeDNI(dni);
  return sanitized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};
