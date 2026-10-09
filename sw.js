// Offline shell: pages and assets from cache, live numbers from the network (last good copy if offline).
const VERSION = "flip-v1";
const SHELL = ["/", "/widget", "/manifest.webmanifest", "/widget.webmanifest", "/img/xbt.png", "/img/shat.png", "/img/tether.png",
  "/img/icon-192.png", "/data/prefork.json", "/media/shatcoin-poster.jpg",
  "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/media/") && url.pathname.endsWith(".mp4")) return; // let video range requests through
  const fresh = url.pathname.startsWith("/api/") || e.request.mode === "navigate";
  if (fresh) {
    // network first, fall back to the last copy we saw
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname === "/" || url.pathname === "/widget" })));
  } else {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; })));
  }
});
