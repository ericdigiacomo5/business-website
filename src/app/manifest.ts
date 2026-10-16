import type { MetadataRoute } from "next"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

// The web app manifest (served at /manifest.webmanifest, linked from every
// page automatically). It's what makes the site installable: the browser
// reads the name, icons and colors from here when someone adds it to their
// home screen, and `display: "standalone"` opens it without the browser's
// address bar, like a native app. Colors match globals.css (--background
// and --foreground).
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: SITE_NAME,
        short_name: "Nail Image",
        description: SITE_TAGLINE,
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f6ead9",
        theme_color: "#16212c",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // Android may crop icons into a circle or squircle — this one
            // keeps the logo inside the central safe zone.
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    }
}
