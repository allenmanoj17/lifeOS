const CACHE_NAME = "epta-lifeos-cache-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/trackdaily",
  "/trackdaily/plan",
  "/trackdaily/calendar",
  "/trackdaily/analytics",
  "/trackdaily/settings",
  "/icon-192.png",
  "/icon-512.png",
  "/icon.svg",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => {
      console.warn("Failed to precache assets during install:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests, ignore chrome-extension / next-hmr / webpack-hmr
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Clone response to cache it
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        return caches.match("/");
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Epta LifeOS", body: event.data?.text() || "Reminder" };
  }

  const title = payload.title || "Epta LifeOS";
  const options = {
    body: payload.body || "Reminder",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "epta-reminder",
    data: payload.data || { url: "/trackdaily" },
    actions: payload.actions || [
      { action: "done", title: "Done" },
      { action: "snooze_15", title: "Snooze 15 min" },
      { action: "skip", title: "Skip" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/trackdaily";

  if (event.action) {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({
              type: "EPTA_NOTIFICATION_ACTION",
              action: event.action,
              taskId: event.notification.data?.taskId,
            });
          }
        })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
