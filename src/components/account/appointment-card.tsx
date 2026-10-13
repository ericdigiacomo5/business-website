import type { Appointment, AppointmentStatus, Artist } from "@/generated/prisma/client"
import { servicesLabel, servicesPriceCents, type ServiceLine } from "@/lib/appointment-services"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/ui/price"
import { discountOf } from "@/lib/discount"
import { formatDuration } from "@/lib/format"
import { durationMinutesOf } from "@/lib/schedule-grid"

export type AppointmentWithRelations = Appointment & { artist: Artist; services: ServiceLine[] }

const STATUS_TONE: Record<AppointmentStatus, "primary" | "success" | "danger" | "muted"> = {
    PENDING: "primary",
    CONFIRMED: "success",
    CANCELLED: "danger",
    COMPLETED: "muted",
    // A customer's own appointment can reach NO_SHOW only via an admin
    // marking it so — this map just needs to render it, same tone as
    // CANCELLED ("didn't happen").
    NO_SHOW: "danger",
}

// Only NO_SHOW's label differs from its raw enum value — the underscore
// reads oddly in a plain-text Badge. Mirrors STATUS_LABEL in
// src/components/admin/appointment-shared.ts, kept as its own local copy
// here rather than imported since this is a customer-facing component and
// that module lives under the admin tree.
const STATUS_LABEL: Record<AppointmentStatus, string> = {
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
    CANCELLED: "CANCELLED",
    COMPLETED: "COMPLETED",
    NO_SHOW: "NO-SHOW",
}

export function AppointmentCard({
    appointment,
    cancellable,
    onCancel,
    cancelling,
}: {
    appointment: AppointmentWithRelations
    cancellable: boolean
    onCancel: () => void
    cancelling: boolean
}) {
    return (
        <div
            className={
                cancellable
                    ? "flex flex-col gap-3 rounded-sm border-2 border-accent bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
                    : "flex flex-col gap-3 rounded-sm border border-foreground bg-surface p-5 opacity-85 sm:flex-row sm:items-center sm:justify-between"
            }
        >
            <div>
                <div className="font-serif text-lg font-bold text-surface-foreground">
                    {servicesLabel(appointment.services)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">with {appointment.artist.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                    {new Date(appointment.startTime).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatDuration(durationMinutesOf(appointment))} &middot;{" "}
                    <Price priceCents={servicesPriceCents(appointment.services)} discount={discountOf(appointment)} />
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
                {cancellable && (
                    <Button
                        variant="danger"
                        size="md"
                        onClick={onCancel}
                        disabled={cancelling}
                        className="sm:shrink-0"
                    >
                        {cancelling ? "Cancelling..." : "Cancel"}
                    </Button>
                )}
            </div>
        </div>
    )
}
