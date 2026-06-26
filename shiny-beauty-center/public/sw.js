// Shiny Beauty Center — Service Worker (Phase 1: offline app shell)
const CACHE_NAME = "shiny-beauty-v1";
const OFFLINE_URL = "/en";

// Resources to pre-cache for offline shell
const PRECACHE_URLS = [
  "/en",
  "/ar",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;

  // Network-first for API and auth calls
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase.co")) {
    return; // Let browser handle normally
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful navigation responses
        if (response.ok && event.request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches
          .match(event.request)
          .then((cached) => cached ?? caches.match(OFFLINE_URL));
      })
  );
});
