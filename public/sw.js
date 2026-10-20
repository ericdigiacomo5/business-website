// Service worker for the installable app (PWA). Hand-written and small on
// purpose — no Workbox/next-pwa dependency. Registered by
// src/components/pwa/service-worker-registration.tsx in production only.
//
// What it does:
//   - Pages: always fetched from the network. If the network is down, the
//     self-contained /offline.html is shown instead of the browser's error.
//   - Next's build assets (/_next/static/*): cached after first use. Their
//     file names contain a content hash, so a cached copy can never be stale;
//     this just makes repeat visits and app launches faster.
//   - Everything else — every /api/* call, bookings, availability, sign-in —
//     goes straight to the network and is NEVER cached. Booking data must
//     always be live (an "open" slot from a cache could already be taken),
//     and pages for a signed-in customer contain personal details that
//     shouldn't sit in a cache on a shared device.
//
// Changing this file: bump CACHE_VERSION so old caches are cleared on the
// next visit. The browser re-checks sw.js on every navigation (next.config.ts
// serves it with no-cache), installs the new version, and the activate step
// below deletes caches from older versions.

const CACHE_VERSION = "v2"
const STATIC_CACHE = `nail-image-static-${CACHE_VERSION}`
const OFFLINE_CACHE = `nail-image-offline-${CACHE_VERSION}`
const OFFLINE_URL = "/offline.html"

// Downloaded when the worker installs, so the offline page works even if the
// very first visit is the last one with a connection.
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"]

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(OFFLINE_CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            // Take over from an older version right away rather than waiting
            // for every open tab to close — safe here because this worker
            // never serves cached pages, only static assets and the fallback.
            .then(() => self.skipWaiting())
    )
})

self.addEventListener("activate", (event) => {
    const current = new Set([STATIC_CACHE, OFFLINE_CACHE])
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => !current.has(key)).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener("fetch", (event) => {
    const request = event.request
    if (request.method !== "GET") return

    const url = new URL(request.url)
    // Only this site's own requests; anything cross-origin (Cloudinary
    // uploads and images) is left entirely to the browser.
    if (url.origin !== self.location.origin) return

    // Page loads: network first, offline page as the fallback.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(async () => {
                const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })
                return offline ?? Response.error()
            })
        )
        return
    }

    // Files precached at install (the offline page's own icon): served from
    // the cache, so the offline page is complete with no network at all.
    if (PRECACHE.includes(url.pathname)) {
        event.respondWith(
            caches.match(request, { cacheName: OFFLINE_CACHE }).then((cached) => cached ?? fetch(request))
        )
        return
    }

    // Hashed build assets: cache first, fill the cache on a miss.
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const cached = await cache.match(request)
                if (cached) return cached
                const response = await fetch(request)
                if (response.ok) cache.put(request, response.clone())
                return response
            })
        )
        return
    }

    // Everything else (including /api/*): not intercepted — normal network.
})
