'use client'

import { useEffect } from "react"

// Registers /sw.js (public/sw.js) once the page has loaded. Production only:
// in `next dev`, build asset URLs aren't content-hashed, so the worker's
// cache-first rule for /_next/static could serve stale code during
// development. In dev this instead removes any worker left over from testing
// a production build on the same localhost port.
// (Not named ServiceWorkerRegistration — that's a built-in browser type.)
export function RegisterServiceWorker() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return

        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) registration.unregister()
            })
            return
        }

        // updateViaCache: "none" — always check the network for a newer
        // sw.js, never the HTTP cache.
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
            // Not fatal: the site works the same without it, just without
            // the offline page and install support.
        })
    }, [])

    return null
}
