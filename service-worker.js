// ============================================================
// SERVICE WORKER — Stress PWA (Final Version)
// ============================================================

const CACHE_NAME = "stress-cache-v14";

// ✅ Static assets to cache
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/main.js",
  "/manifest.json",

  // ✅ Icons
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png"
];

// ============================================================
// INSTALL — Cache all static assets
// ============================================================

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — Remove old caches
// ============================================================

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// ============================================================
// FETCH — Network first, fallback to cache
// ============================================================

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ✅ Cache updated version
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request)) // ✅ Offline fallback
  );
});
