// Which services an artist performs (FEATURE_GAPS.md Gap 23). Pure, so the
// booking wizard and the admin pages can use it as well as the routes.
//
// An artist's list is the serviceIds of their ArtistService rows. An empty
// list means "every service": that's the default for a new artist and for
// every artist from before the table existed, and it means a service added
// later is bookable with them without anyone remembering to tick it.

// Prisma include for an Artist's service list — a plain object (no Prisma
// import) so client and server code can share the shape.
export const ARTIST_SERVICES_INCLUDE = {
    services: { select: { serviceId: true } },
} as const

export function offeredServiceIdsOf(artist: { services: { serviceId: string }[] }): string[] {
    return artist.services.map((row) => row.serviceId)
}

// Of `serviceIds`, the ones this artist doesn't perform, in the same order.
export function servicesNotOffered(offered: readonly string[], serviceIds: readonly string[]): string[] {
    if (offered.length === 0) return []
    const set = new Set(offered)
    return serviceIds.filter((id) => !set.has(id))
}

export function artistOffersAll(offered: readonly string[], serviceIds: readonly string[]): boolean {
    return servicesNotOffered(offered, serviceIds).length === 0
}

// "Gel Manicure" / "Gel Manicure and Pedicure" / "A, B and C" — for the
// booking routes' refusal message.
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? ""
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
