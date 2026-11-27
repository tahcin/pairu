// Pairu service worker: the app opens offline and on weak networks. The app shell, sample photos
// and the crop list are cached; advice cards already seen are kept for offline reading. Diagnosis,
// voice and weather always need the network.
const VERSION = "pairu-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(fallbackUrl || request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(fallbackUrl || request);
    if (hit) return hit;
    throw e;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // The Geist font from jsDelivr.
    if (url.hostname === "cdn.jsdelivr.net") event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "/index.html"));
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/samples/") || SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.pathname === "/api/crops" || url.pathname === "/api/advice" || url.pathname === "/data/kb.json") {
    event.respondWith(networkFirst(req));
  }
});
