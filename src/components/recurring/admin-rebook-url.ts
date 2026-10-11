// Where an admin lands after "Change Time" on a standing appointment: the
// admin booking wizard, with the same customer, service, and artist already
// chosen, so only the new day/time needs picking. There's deliberately no
// "edit series" — changing one is cancel + book a new one.
export function adminRebookUrl(series: { userId: string; serviceId: string; artistId: string }): string {
    const params = new URLSearchParams({
        userId: series.userId,
        serviceId: series.serviceId,
        artistId: series.artistId,
    })
    return `/admin/book?${params.toString()}`
}
