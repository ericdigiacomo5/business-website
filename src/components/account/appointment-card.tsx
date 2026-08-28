import type { Appointment, AppointmentStatus, Artist, Service } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"

export type AppointmentWithRelations = Appointment & { artist: Artist; service: Service }

const STATUS_TONE: Record<AppointmentStatus, "primary" | "success" | "danger" | "muted"> = {
    UPCOMING: "primary",
    CONFIRMED: "success",
    CANCELLED: "danger",
    COMPLETED: "muted",
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
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{appointment.service.name}</span>
                    <Badge tone={STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    with {appointment.artist.name} &middot;{" "}
                    {new Date(appointment.startTime).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    })}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatDuration(appointment.service.durationMinutes)} &middot;{" "}
                    {formatPrice(appointment.service.priceCents)}
                </p>
            </div>
            {cancellable && (
                <Button variant="danger" size="md" onClick={onCancel} disabled={cancelling} className="sm:shrink-0">
                    {cancelling ? "Cancelling..." : "Cancel"}
                </Button>
            )}
        </div>
    )
}
