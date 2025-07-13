const CACHE_NAME = "irl-game-cache-v1";
const urlsToCache = [
  "/",
  "/client.js",
  "/index.html",
  "/style.css", // si tu as un fichier CSS
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) =>
      response || fetch(event.request)
    )
  );
});