/* ============================================================
   service-worker.js — FINAL (audio sampai 10 min sahaja)
============================================================ */

const CACHE = "stress-cache-v18";

const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./firebase.js",
  "./manifest.json",

  // Audio fokus 1–10 minit
  "./sounds/focus1min.mp3",
  "./sounds/focus2min.mp3",
  "./sounds/focus3min.mp3",
  "./sounds/focus4min.mp3",
  "./sounds/focus5min.mp3",
  "./sounds/focus6min.mp3",
  "./sounds/focus7min.mp3",
  "./sounds/focus8min.mp3",
  "./sounds/focus9min.mp3",
  "./sounds/focus10min.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(FILES);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
