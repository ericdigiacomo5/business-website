// Writes an artist's service list (FEATURE_GAPS.md Gap 23) — server-only,
// inside the caller's transaction. The rules for reading it are in the pure
// sibling, src/lib/artist-services.ts.

import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { joinNames, servicesNotOffered } from "@/lib/artist-services"

type Tx = Prisma.TransactionClient

// Why a customer can't book this artist for these services, or null if they
// can. The booking routes call it for customers only: an admin may book an
// artist outside their list (the schedule's booking sheet warns them).
export async function artistServicesError(
    artist: { id: string; name: string },
    serviceIds: string[]
): Promise<string | null> {
    const rows = await prisma.artistService.findMany({ where: { artistId: artist.id }, select: { serviceId: true } })
    const missing = servicesNotOffered(rows.map((row) => row.serviceId), serviceIds)
    if (missing.length === 0) return null

    const services = await prisma.service.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })
    const names = missing.map((id) => services.find((service) => service.id === id)?.name ?? "that service")
    return `${artist.name} doesn't do ${joinNames(names)}. Please choose another artist.`
}

// The request's `serviceIds` for an artist: null or [] = every service, a
// list = only those. Returns the distinct ids, or a message saying why not.
// Existence is checked by setArtistServices().
export function parseArtistServiceIds(value: unknown): string[] | string {
    if (value === null) return []
    if (!Array.isArray(value) || value.length > 200) return "Services must be a list of service ids"
    if (!value.every((id) => typeof id === "string" && id.length > 0)) return "Services must be a list of service ids"
    return [...new Set(value as string[])]
}

// Replaces the artist's list. Returns false (writing nothing) if any id
// isn't a real service. Retired services are allowed: an artist's list may
// keep one that's been switched off, and reactivating it restores it.
export async function setArtistServices(tx: Tx, artistId: string, serviceIds: string[]): Promise<boolean> {
    if (serviceIds.length > 0) {
        const found = await tx.service.count({ where: { id: { in: serviceIds } } })
        if (found !== serviceIds.length) return false
    }

    await tx.artistService.deleteMany({ where: { artistId } })
    if (serviceIds.length > 0) {
        await tx.artistService.createMany({ data: serviceIds.map((serviceId) => ({ artistId, serviceId })) })
    }
    return true
}
