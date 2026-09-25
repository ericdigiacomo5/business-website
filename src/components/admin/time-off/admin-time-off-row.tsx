import type { TimeOff } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toLocalDateKey } from "@/lib/format"
import { TimeOffForm, type TimeOffFormValues } from "./time-off-form"

export function AdminTimeOffRow({
    timeOff,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onDelete,
}: {
    timeOff: TimeOff
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: TimeOffFormValues) => void
    onDelete: () => void
}) {
    if (isEditing) {
        return (
            <TimeOffForm
                submitLabel="Save Changes"
                initial={{
                    date: toLocalDateKey(new Date(timeOff.date)),
                    endDate: timeOff.endDate ? toLocalDateKey(new Date(timeOff.endDate)) : null,
                    startTime: timeOff.startTime,
                    endTime: timeOff.endTime,
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    const dateLabel = timeOff.endDate
        ? `${new Date(timeOff.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(
              timeOff.endDate
          ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : new Date(timeOff.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
          })

    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-surface-foreground">{dateLabel}</span>
                    {!timeOff.artistId && (
                        <Badge tone="accent">Salon-Wide</Badge>
                    )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {timeOff.startTime} &ndash; {timeOff.endTime}
                </p>
            </div>

            <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="md" onClick={onEdit}>
                    Edit
                </Button>
                <Button variant="danger" size="md" onClick={onDelete}>
                    Delete
                </Button>
            </div>
        </div>
    )
}