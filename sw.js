const CACHE_NAME = "simple-food-tracker-v10";
const APP_SHELL = [
    "./",
    "./index.html",
    "./styles/main.css",
    "./scripts/main.js",
    "./scripts/variables.js",
    "./scripts/helpers.js",
    "./scripts/handlers.js",
    "./manifest.webmanifest",
    "./assets/icon.svg",
];
const CDN_ASSETS = ["https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(async (cache) => {
                await cache.addAll(APP_SHELL);
                await Promise.all(
                    CDN_ASSETS.map(async (asset) => {
                        try {
                            const response = await fetch(asset, { mode: "no-cors" });
                            await cache.put(asset, response);
                        } catch {
                            // The app shell should still install when the CDN is offline.
                        }
                    })
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request)
                .then((networkResponse) => {
                    const requestUrl = new URL(event.request.url);
                    const canCache =
                        networkResponse &&
                        (networkResponse.ok || networkResponse.type === "opaque") &&
                        (requestUrl.origin === self.location.origin || CDN_ASSETS.includes(event.request.url));

                    if (canCache) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }

                    return networkResponse;
                })
                .catch(() => {
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }

                    return new Response("", { status: 503, statusText: "Offline" });
                });
        })
    );
});

