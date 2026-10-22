const CACHE = "gg-cash-book-public-v1";
const PUBLIC_ASSETS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("gg-cash-book-public-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    // Never cache account HTML, RSC responses, API responses, or financial data.
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  } else if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
  }
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
      const app = windows.find(window => new URL(window.url).origin === self.location.origin);
      if (app) {
        app.postMessage({ type: "OPEN_REMINDERS" });
        await app.focus();
      } else {
        await self.clients.openWindow("/#reminders");
      }
    }),
  );
});
