// ============================================================
// service-worker.js — FINAL VERSION (cache audio 1–45 min)
// ============================================================

const CACHE = "stress-cache-v21";

// ✅ Auto-generate senarai audio 1–45 minit
const audioFiles = Array.from({ length: 45 }, (_, i) => `./focus${i + 1}min.mp3`);

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./firebase.js",
  "./manifest.json",
  ...audioFiles
];

// ✅ INSTALL — cache semua file
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES))
  );
});

// ✅ FETCH — cache-first
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
