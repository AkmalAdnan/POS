/* eslint-disable no-restricted-globals */
// Spice Route POS — minimal offline-first service worker
// - App shell cache (cache-first for static assets)
// - Network-first for API GETs with cache fallback
// - Background sync for queued POSTs (best-effort)

const CACHE_VERSION = "spice-pos-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/pwa-icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

const QUEUE_DB = "spice-pos-queue";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(request) {
  try {
    const db = await openDb();
    const body = await request.clone().text();
    const tx = db.transaction("requests", "readwrite");
    tx.objectStore("requests").add({
      url: request.url,
      method: request.method,
      headers: [...request.headers.entries()],
      body,
      ts: Date.now(),
    });
    return new Promise((res) => (tx.oncomplete = res));
  } catch (e) { /* noop */ }
}

async function flushQueue() {
  try {
    const db = await openDb();
    const tx = db.transaction("requests", "readwrite");
    const store = tx.objectStore("requests");
    const all = await new Promise((res) => {
      const r = store.getAll();
      r.onsuccess = () => res(r.result || []);
    });
    for (const item of all) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: new Headers(item.headers),
          body: item.body,
          credentials: "include",
        });
        if (res.ok) {
          await new Promise((r) => {
            const d = store.delete(item.id); d.onsuccess = r;
          });
        }
      } catch { /* keep in queue */ }
    }
  } catch { /* noop */ }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "GET") {
    const url = new URL(request.url);
    // API GET → network first then cache
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        }).catch(() => caches.match(request)),
      );
      return;
    }
    // Static / app-shell → cache first
    event.respondWith(
      caches.match(request).then((c) => c || fetch(request).then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE_VERSION).then((cc) => cc.put(request, copy)).catch(() => {});
        return res;
      })),
    );
    return;
  }

  // For mutating requests, try network; on failure queue for later sync
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await enqueue(request);
        return new Response(JSON.stringify({ queued: true, message: "Offline — request queued" }),
          { status: 202, headers: { "Content-Type": "application/json" } });
      }),
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "spice-flush") event.waitUntil(flushQueue());
});

self.addEventListener("message", (event) => {
  if (event.data === "FLUSH") flushQueue();
});
