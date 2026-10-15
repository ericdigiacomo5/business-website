// Client-safe (type-only Prisma import) — the admin services form and the
// schedule grid both need the list of categories and their labels, and the
// generated Prisma enum object can't be imported into client code without
// pulling in the Prisma runtime (see PROJECT_STATUS.md's RSC-boundary notes).

import type { ServiceType } from "@/generated/prisma/client"

// The single source of truth for categories. Record<ServiceType, ...> fails
// to compile if an enum value is missing or misspelled, so adding a value to
// the ServiceType enum forces an entry here. Key order is display order (the
// Services page sections, the admin dropdown, the grid legend).
export const SERVICE_CATEGORY_LABEL: Record<ServiceType, string> = {
    HANDS: "Hands",
    FEET: "Feet",
    WAX: "Wax",
}

// Derived, not hand-maintained, so it can't drift from the labels above.
// The cast is safe: the Record type guarantees the keys are exactly
// ServiceType (Object.keys is only typed string[] because TypeScript can't
// rule out extra keys on objects in general).
export const SERVICE_CATEGORIES = Object.keys(SERVICE_CATEGORY_LABEL) as ServiceType[]

export function isServiceCategory(value: unknown): value is ServiceType {
    return typeof value === "string" && (SERVICE_CATEGORIES as string[]).includes(value)
}
