// Service Worker mínimo
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // listo
});

self.addEventListener("fetch", () => {
  // por ahora no cacheamos nada
});
