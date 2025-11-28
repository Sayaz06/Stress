/* ============================================================
   service-worker.js — FINAL VERSION
============================================================ */

const CACHE = "stress-cache-v16";

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./firebase.js",
  "./manifest.json",

  // ✅ Bunyi fokus (silent + alarm)
  "./sounds/focus1min.mp3",
  "./sounds/focus5min.mp3",
  "./sounds/focus10min.mp3",
  "./sounds/focus15min.mp3",
  "./sounds/focus20min.mp3",
  "./sounds/focus25min.mp3",
  "./sounds/focus30min.mp3",
  "./sounds/focus45min.mp3"
];

// ✅ Install SW & cache semua file
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(FILES);
    })
  );
});

// ✅ Fetch handler — offline fallback
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
