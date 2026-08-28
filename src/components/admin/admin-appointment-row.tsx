import type { Appointment, AppointmentStatus, Artist, Service, User } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"

export type AdminAppointment = Appointment & { artist: Artist; service: Service; user: User }

const STATUS_TONE: Record<AppointmentStatus, "primary" | "success" | "danger" | "muted"> = {
    UPCOMING: "primary",
    CONFIRMED: "success",
    CANCELLED: "danger",
    COMPLETED: "muted",
}

export function AdminAppointmentRow({
    appointment,
    busy,
    onConfirm,
    onComplete,
    onCancel,
}: {
    appointment: AdminAppointment
    busy: boolean
    onConfirm: () => void
    onComplete: () => void
    onCancel: () => void
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
                    {appointment.user.name ?? appointment.user.email} &middot;{" "}
                    {formatDuration(appointment.service.durationMinutes)} &middot;{" "}
                    {formatPrice(appointment.service.priceCents)}
                </p>
            </div>

            {(appointment.status === "UPCOMING" || appointment.status === "CONFIRMED") && (
                <div className="flex shrink-0 gap-2">
                    {appointment.status === "UPCOMING" && (
                        <Button variant="secondary" size="md" onClick={onConfirm} disabled={busy}>
                            Confirm
                        </Button>
                    )}
                    {appointment.status === "CONFIRMED" && (
                        <Button variant="secondary" size="md" onClick={onComplete} disabled={busy}>
                            Mark Completed
                        </Button>
                    )}
                    <Button variant="danger" size="md" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                </div>
            )}
        </div>
    )
}