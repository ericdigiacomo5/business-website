// Everything an artist card shows (FEATURE_GAPS.md U12) — server-only.
// Shared by the home page and /artists so both cards say the same thing.

import { prisma } from "@/lib/prisma"
import { getNextOpenings } from "@/lib/availability"
import { BOOKING_WINDOW_DAYS } from "@/lib/recurring"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "@/lib/service-category"
import { isCloudinaryUrl } from "@/lib/validation"

export type ArtistCardData = {
    id: string
    name: string
    bio: string | null
    photoUrl: string | null
    // Up to three, newest first; only uploaded (Cloudinary) images.
    thumbnails: { id: string; imageUrl: string; caption: string | null }[]
    // What they do: their own service list's names, or — for an artist who
    // does every service — the categories on the menu.
    specialties: string[]
    // Their next bookable time for the shortest service, within the
    // customer booking window; null = fully booked (or no hours set).
    nextOpening: Date | null
}

const MAX_SPECIALTIES = 3
const THUMBNAILS = 3

export async function loadArtistCards(options: { take?: number } = {}): Promise<ArtistCardData[]> {
    const [artists, services] = await Promise.all([
        prisma.artist.findMany({
            where: { active: true },
            include: {
                services: { select: { service: { select: { name: true, active: true } } } },
                portfolio: { orderBy: { createdAt: "desc" }, take: 12 },
            },
            orderBy: { createdAt: "asc" },
            take: options.take,
        }),
        prisma.service.findMany({ where: { active: true }, select: { category: true, durationMinutes: true } }),
    ])

    const shortest = services.length > 0 ? Math.min(...services.map((s) => s.durationMinutes)) : null
    const openings = shortest
        ? await getNextOpenings(artists.map((a) => a.id), shortest, BOOKING_WINDOW_DAYS)
        : {}
    const menuCategories = SERVICE_CATEGORIES.filter((category) => services.some((s) => s.category === category)).map(
        (category) => SERVICE_CATEGORY_LABEL[category]
    )

    return artists.map((artist) => {
        const own = artist.services.filter((row) => row.service.active).map((row) => row.service.name)
        const specialties =
            own.length === 0
                ? menuCategories
                : own.length > MAX_SPECIALTIES
                  ? [...own.slice(0, MAX_SPECIALTIES), `+${own.length - MAX_SPECIALTIES} more`]
                  : own

        return {
            id: artist.id,
            name: artist.name,
            bio: artist.bio,
            photoUrl: artist.photoUrl,
            thumbnails: artist.portfolio.filter((image) => isCloudinaryUrl(image.imageUrl)).slice(0, THUMBNAILS),
            specialties,
            nextOpening: openings[artist.id] ?? null,
        }
    })
}
