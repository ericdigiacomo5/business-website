import { isCloudinaryUrl } from "@/lib/validation"

// Server-side check for image URLs the API stores (artist photos, portfolio
// images): a delivery URL from the salon's OWN Cloudinary account. Fails
// closed — with CLOUDINARY_CLOUD_NAME unset, nothing is accepted, rather
// than isCloudinaryUrl()'s client-side default of any account (which is only
// right for display). Uploads can't happen without it anyway: the signing
// route refuses when Cloudinary isn't configured.
export function isOwnCloudinaryUrl(value: unknown): value is string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    return cloudName ? isCloudinaryUrl(value, cloudName) : false
}
