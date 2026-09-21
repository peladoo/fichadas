// IMPORTANTE: Incrementar este número cada vez que actualices la PWA
const VERSION = "2.0.0";
const CACHE_NAME = `fichadas-muni-v${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const urlsToCache = ["/", "/manifest.json"];

// Instalación: cachear recursos estáticos y forzar activación inmediata
self.addEventListener("install", (event) => {
  console.log("[SW] Instalando versión:", VERSION);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Cacheando recursos");
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Forzar activación inmediata
  );
});

// Activación: limpiar cachés antiguas y tomar control inmediato
self.addEventListener("activate", (event) => {
  console.log("[SW] Activando versión:", VERSION);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log("[SW] Eliminando caché antigua:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Tomar control de todas las pestañas inmediatamente
  );
});

// Fetch: estrategia Network First para contenido dinámico
self.addEventListener("fetch", (event) => {
  // Solo cachear requests GET
  if (event.request.method !== "GET") {
    return;
  }

  // Ignorar requests a APIs externas
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en caché
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar obtener del caché
        return caches.match(event.request);
      })
  );
});

// Mensaje desde el cliente para forzar actualización
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Forzando actualización...");
    self.skipWaiting();
  }
});
