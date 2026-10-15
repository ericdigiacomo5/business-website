// Client-safe (no Prisma value imports) — an appointment can have several
// services, and everything that shows or totals them goes through here so
// "what is this appointment, what does it cost, how long is it usually" has
// one definition.

import type { ServiceType } from "@/generated/prisma/client"
import { MAX_APPOINTMENT_MINUTES } from "@/lib/schedule-grid"

// Most services one appointment (or standing appointment) can hold.
export const MAX_SERVICES_PER_APPOINTMENT = 8

// One service on an appointment, as every read returns it: the price and
// duration it was booked at, plus the service itself for its name and
// category (the schedule grid colors a block by its first line's category).
export type ServiceLine = {
    serviceId: string
    priceCents: number
    durationMinutes: number
    service: { id: string; name: string; category: ServiceType }
}

// Prisma include for an Appointment's services, in booked order. A plain
// object (no Prisma import) so client and server code can share the shape.
export const SERVICE_LINES_INCLUDE = {
    services: { include: { service: true }, orderBy: { position: "asc" as const } },
}

// "Manicure + Pedicure"
export function servicesLabel(lines: { service: { name: string } }[]): string {
    return lines.map((line) => line.service.name).join(" + ")
}

export function servicesPriceCents(lines: { priceCents: number }[]): number {
    return lines.reduce((sum, line) => sum + line.priceCents, 0)
}

// The usual length for these services — an appointment's actual length is
// its own startTime..endTime, which an admin may have set differently.
export function servicesDurationMinutes(lines: { durationMinutes: number }[]): number {
    return lines.reduce((sum, line) => sum + line.durationMinutes, 0)
}

// Validates a request's `serviceIds`: a non-empty list of distinct ids, in
// the order they should appear. Returns the ids, or a message saying why not.
export function parseServiceIds(value: unknown): string[] | string {
    if (!Array.isArray(value) || value.length === 0) {
        return "At least one service is required"
    }
    if (value.length > MAX_SERVICES_PER_APPOINTMENT) {
        return `An appointment can have at most ${MAX_SERVICES_PER_APPOINTMENT} services`
    }
    if (!value.every((id): id is string => typeof id === "string" && id.length > 0)) {
        return "serviceIds must be a list of service ids"
    }
    if (new Set(value).size !== value.length) {
        return "Each service can only be added once"
    }
    return value
}

// Whether a set of services fits in one appointment at their usual lengths.
export function servicesFitOneAppointment(lines: { durationMinutes: number }[]): boolean {
    return servicesDurationMinutes(lines) <= MAX_APPOINTMENT_MINUTES
}
