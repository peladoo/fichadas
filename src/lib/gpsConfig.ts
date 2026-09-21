// Configuración de ubicaciones GPS y validación de cercanía

export interface Ubicacion {
  lat: number;
  lng: number;
  radius: number; // Radio en metros (~100m = 1 manzana)
  nombre: string;
}

/**
 * Tiempo mínimo entre fichadas del mismo usuario (en minutos)
 */
export const TIEMPO_MINIMO_ENTRE_FICHADAS = 5;

/**
 * Calcula la distancia entre dos puntos GPS usando la fórmula de Haversine
 * @param lat1 Latitud del punto 1
 * @param lng1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lng2 Longitud del punto 2
 * @returns Distancia en metros
 */
export const calcularDistancia = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Verifica si el usuario está dentro del radio permitido de una dependencia
 */
export const estaDentroDelRadio = (
  posicionUsuario: { lat: number; lng: number },
  dependencia: Ubicacion
): {
  dentroDelRadio: boolean;
  distancia: number;
  dependencia: string;
} => {
  const distancia = calcularDistancia(
    posicionUsuario.lat,
    posicionUsuario.lng,
    dependencia.lat,
    dependencia.lng
  );

  return {
    dentroDelRadio: distancia <= dependencia.radius,
    distancia: Math.round(distancia),
    dependencia: dependencia.nombre
  };
};

/**
 * Encuentra la dependencia más cercana a la ubicación del usuario
 */
export const encontrarDependenciaCercana = (
  posicionUsuario: { lat: number; lng: number },
  lista: Ubicacion[],
): (Ubicacion & { distancia: number }) | null => {
  let dependenciaMasCercana: (Ubicacion & { distancia: number }) | null = null;
  let menorDistancia = Infinity;

  lista.forEach((dep) => {
    const distancia = calcularDistancia(
      posicionUsuario.lat,
      posicionUsuario.lng,
      dep.lat,
      dep.lng
    );

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      dependenciaMasCercana = {
        ...dep,
        distancia: Math.round(distancia)
      };
    }
  });

  return dependenciaMasCercana;
};

/**
 * Valida si el usuario puede fichar desde su ubicación actual
 */
export const validarUbicacionParaFichar = (
  posicionUsuario: { lat: number; lng: number },
  lista: Ubicacion[],
): {
  permitido: boolean;
  mensaje: string;
  dependenciaCercana: (Ubicacion & { distancia: number }) | null;
} => {
  const dependenciaCercana = encontrarDependenciaCercana(posicionUsuario, lista);

  if (!dependenciaCercana) {
    return {
      permitido: false,
      mensaje: 'No se encontró ninguna dependencia cercana',
      dependenciaCercana: null
    };
  }

  const validacion = estaDentroDelRadio(posicionUsuario, dependenciaCercana);

  if (!validacion.dentroDelRadio) {
    return {
      permitido: false,
      mensaje: `⚠️ Estás a ${validacion.distancia}m de ${validacion.dependencia}. Debes estar dentro de ${dependenciaCercana.radius}m para fichar.`,
      dependenciaCercana
    };
  }

  return {
    permitido: true,
    mensaje: `✓ Ubicación válida: ${validacion.dependencia} (${validacion.distancia}m)`,
    dependenciaCercana
  };
};

/**
 * Valida si el usuario puede fichar desde su ubicación actual para una dependencia específica
 * @param posicionUsuario Posición GPS del usuario
 * @param dependenciaSeleccionada Datos de la dependencia seleccionada (con latitud, longitud y radio)
 */
/**
 * Interfaz para dependencias que vienen de la base de datos
 */
export interface DependenciaBD {
  id: string;
  nombre: string;
  latitud?: number | null;
  longitud?: number | null;
  radio_metros?: number | null;
}

/**
 * Encuentra la dependencia más cercana de una lista de dependencias (de la BD)
 * Solo considera dependencias que tengan coordenadas GPS configuradas
 * @param posicionUsuario Posición GPS del usuario
 * @param listaDependencias Lista de dependencias de la BD
 * @returns La dependencia más cercana con su distancia, o null si ninguna tiene GPS
 */
export const encontrarDependenciaMasCercanaDeLista = (
  posicionUsuario: { lat: number; lng: number },
  listaDependencias: DependenciaBD[]
): (DependenciaBD & { distancia: number }) | null => {
  let dependenciaMasCercana: (DependenciaBD & { distancia: number }) | null = null;
  let menorDistancia = Infinity;

  listaDependencias.forEach((dep) => {
    // Solo considerar dependencias con coordenadas configuradas
    if (!dep.latitud || !dep.longitud) return;

    const distancia = calcularDistancia(
      posicionUsuario.lat,
      posicionUsuario.lng,
      dep.latitud,
      dep.longitud
    );

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      dependenciaMasCercana = {
        ...dep,
        distancia: Math.round(distancia)
      };
    }
  });

  return dependenciaMasCercana;
};

export const validarUbicacionParaDependencia = (
  posicionUsuario: { lat: number; lng: number },
  dependenciaSeleccionada: {
    nombre: string;
    latitud?: number | null;
    longitud?: number | null;
    radio_metros?: number | null;
  }
): {
  permitido: boolean;
  mensaje: string;
  distancia: number | null;
} => {
  // Si la dependencia no tiene coordenadas configuradas, permitir siempre
  if (!dependenciaSeleccionada.latitud || !dependenciaSeleccionada.longitud) {
    return {
      permitido: true,
      mensaje: `✓ Fichando en ${dependenciaSeleccionada.nombre} (sin validación GPS configurada)`,
      distancia: null
    };
  }

  const radio = dependenciaSeleccionada.radio_metros || 100; // Default 100 metros

  const distancia = calcularDistancia(
    posicionUsuario.lat,
    posicionUsuario.lng,
    dependenciaSeleccionada.latitud,
    dependenciaSeleccionada.longitud
  );

  const distanciaRedondeada = Math.round(distancia);

  if (distancia <= radio) {
    return {
      permitido: true,
      mensaje: `✓ Ubicación válida: ${dependenciaSeleccionada.nombre} (${distanciaRedondeada}m)`,
      distancia: distanciaRedondeada
    };
  }

  return {
    permitido: false,
    mensaje: `⚠️ Estás a ${distanciaRedondeada}m de ${dependenciaSeleccionada.nombre}. Debes estar dentro de ${radio}m para fichar.`,
    distancia: distanciaRedondeada
  };
};
