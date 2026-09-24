import type { Appointment, AppointmentStatus, Artist, PaymentMethod, Service, User } from "@/generated/prisma/client"

// Deliberately a Pick, not the full `User`. This type crosses a Server→Client
// boundary, so every field named here is serialized into the browser payload —
// widening it back to `User` would ship passwordHash. Keep this in sync with
// SAFE_USER_SELECT_BASIC in src/lib/user-select.ts, which is what the query
// actually fetches; a mismatch is a type error at the call site rather than a
// silent leak.
export type AdminAppointmentUser = Pick<User, "id" | "name" | "email" | "phone">

export type AdminAppointment = Appointment & {
    artist: Artist
    service: Service
    user: AdminAppointmentUser
}

export const STATUS_TONE: Record<AppointmentStatus, "primary" | "success" | "danger" | "muted"> = {
    UPCOMING: "primary",
    CONFIRMED: "success",
    CANCELLED: "danger",
    COMPLETED: "muted",
}

// Indexed by an artist's position in the existing createdAt-ascending order
// (same order the artists query already uses), so column coloring is stable
// across reloads rather than reshuffled. Built only from this project's
// existing design tokens (same bg-*/opacity pattern Badge's tone map uses) —
// a skim aid for telling columns apart at a glance, not a unique identifier,
// so the cycle repeating past 4 artists is an acceptable trade-off (blocks
// are still labeled with text regardless of color).
// `block` uses opaque bg-schedule-tint-* tokens (see globals.css), not
// bg-*/opacity utilities — a translucent fill lets the grid lines underneath
// show through the block, which is exactly what these are meant to hide.
export const ARTIST_COLOR_CYCLE: { header: string; block: string; blockBorder: string }[] = [
    { header: "bg-primary/10 text-primary", block: "bg-schedule-tint-primary", blockBorder: "border-primary/40" },
    { header: "bg-accent/20 text-accent-foreground", block: "bg-schedule-tint-accent", blockBorder: "border-accent/50" },
    { header: "bg-success/10 text-success", block: "bg-schedule-tint-success", blockBorder: "border-success/40" },
    { header: "bg-muted text-muted-foreground", block: "bg-schedule-tint-muted", blockBorder: "border-border" },
]

// Small left-edge bar color per status, layered on top of the artist's
// background fill on each block — kept separate from ARTIST_COLOR_CYCLE so
// "whose column" and "what state" stay two distinct, non-competing signals
// rather than merging into one color system.
export const STATUS_BAR_COLOR: Record<AppointmentStatus, string> = {
    UPCOMING: "bg-primary",
    CONFIRMED: "bg-success",
    CANCELLED: "bg-danger",
    COMPLETED: "bg-muted-foreground",
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    CASH: "Cash",
    CARD: "Card",
    OTHER: "Other",
}
