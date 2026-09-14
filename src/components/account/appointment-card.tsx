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
        <div
            className={
                cancellable
                    ? "flex flex-col gap-3 rounded-sm border-2 border-accent bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
                    : "flex flex-col gap-3 rounded-sm border border-foreground bg-surface p-5 opacity-85 sm:flex-row sm:items-center sm:justify-between"
            }
        >
            <div>
                <div className="font-serif text-lg font-bold text-surface-foreground">
                    {appointment.service.name}
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
                    {formatDuration(appointment.service.durationMinutes)} &middot;{" "}
                    {formatPrice(appointment.service.priceCents)}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[appointment.status]}>{appointment.status}</Badge>
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
