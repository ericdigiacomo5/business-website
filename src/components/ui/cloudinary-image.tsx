import Image from "next/image"
import type { ReactNode } from "react"
import { isCloudinaryUrl } from "@/lib/validation"

// Artist photos and portfolio images, served through next/image (resized to
// the size actually shown, modern formats, lazy-loaded) from Cloudinary —
// the only host the upload flow produces and the only one allowed in
// next.config.ts's images.remotePatterns and the CSP's img-src.
//
// Anything else (an older pasted URL from before uploads-only, or a missing
// photo) renders `fallback` instead: next/image throws on a non-allowlisted
// host, and the CSP would block it anyway.
//
// `className` sizes and shapes the box (e.g. "h-24 w-24 rounded-full"); the
// image fills it. `sizes` tells the browser how wide that box is so it can
// pick a small enough file — e.g. "96px", or "(min-width: 640px) 33vw, 50vw".
export function CloudinaryImage({
    src,
    alt,
    sizes,
    className = "",
    fallback = null,
}: {
    src: string | null | undefined
    alt: string
    sizes: string
    className?: string
    fallback?: ReactNode
}) {
    if (!src || !isCloudinaryUrl(src)) return <>{fallback}</>

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
        </div>
    )
}
