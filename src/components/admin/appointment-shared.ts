import type {
    Appointment,
    AppointmentStatus,
    Artist,
    PaymentMethod,
    ServiceType,
    User,
} from "@/generated/prisma/client"
import type { ServiceLine } from "@/lib/appointment-services"

// Deliberately a Pick, not the full `User`. This type crosses a Server→Client
// boundary, so every field named here is serialized into the browser payload —
// widening it back to `User` would ship passwordHash. Keep this in sync with
// SAFE_USER_SELECT_BASIC in src/lib/user-select.ts, which is what the query
// actually fetches; a mismatch is a type error at the call site rather than a
// silent leak.
export type AdminAppointmentUser = Pick<User, "id" | "name" | "email" | "phone">

export type AdminAppointment = Appointment & {
    artist: Artist
    // One or more, in booked order — see src/lib/appointment-services.ts.
    services: ServiceLine[]
    user: AdminAppointmentUser
}

export const STATUS_TONE: Record<AppointmentStatus, "primary" | "success" | "danger" | "muted"> = {
    PENDING: "primary",
    CONFIRMED: "success",
    CANCELLED: "danger",
    COMPLETED: "muted",
    // Shares CANCELLED's tone — both mean "didn't happen," distinguished by
    // label rather than a third color.
    NO_SHOW: "danger",
}

// Display label per status — only NO_SHOW differs from its raw enum value
// (the underscore reads oddly wherever status renders as plain text, e.g. a
// Badge). Every other status's label is identical to its value.
export const STATUS_LABEL: Record<AppointmentStatus, string> = {
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED",
    COMPLETED: "COMPLETED",
    NO_SHOW: "NO-SHOW",
}

// Column-header tint, indexed by an artist's position in the existing
// createdAt-ascending order (same order the artists query already uses), so
// column coloring is stable across reloads rather than reshuffled — a skim
// aid for telling columns apart, not a unique identifier, so the cycle
// repeating past 4 artists is an acceptable trade-off. Blocks used to share
// this tint; they're colored by service category now (CATEGORY_BLOCK_COLOR),
// since the column already says whose appointment it is.
export const ARTIST_COLOR_CYCLE: { header: string }[] = [
    { header: "bg-primary/10 text-primary" },
    { header: "bg-accent/20 text-accent-foreground" },
    { header: "bg-success/10 text-success" },
    { header: "bg-muted text-muted-foreground" },
]

// Block fill per service category. `block` uses opaque bg-schedule-tint-*
// tokens (see globals.css), not bg-*/opacity utilities — a translucent fill
// lets the grid lines underneath show through the block, which is exactly
// what these are meant to hide. Muted is left unused so it can't be mistaken
// for a completed/inactive block.
export const CATEGORY_BLOCK_COLOR: Record<ServiceType, { block: string; blockBorder: string }> = {
    HANDS: { block: "bg-schedule-tint-primary", blockBorder: "border-primary/40" },
    FEET: { block: "bg-schedule-tint-accent", blockBorder: "border-accent/50" },
    WAX: { block: "bg-schedule-tint-success", blockBorder: "border-success/40" },
}

// An appointment can hold services from several categories; it's colored by
// the first one (services are in booked order), and the block's label still
// names every service.
export function appointmentCategory(appointment: AdminAppointment): ServiceType {
    return appointment.services[0].service.category
}

// Small left-edge bar color per status, layered on top of the category's
// background fill on each block — kept separate from CATEGORY_BLOCK_COLOR so
// "what kind of service" and "what state" stay two distinct, non-competing
// signals rather than merging into one color system.
export const STATUS_BAR_COLOR: Record<AppointmentStatus, string> = {
    PENDING: "bg-primary",
    CONFIRMED: "bg-success",
    CANCELLED: "bg-danger",
    COMPLETED: "bg-muted-foreground",
    NO_SHOW: "bg-danger",
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
    CASH: "Cash",
    CARD: "Card",
    OTHER: "Other",
}
