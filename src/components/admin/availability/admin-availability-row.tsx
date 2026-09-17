import type { Availability } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { AvailabilityForm, DAY_NAMES, type AvailabilityFormValues } from "./availability-form"

export function AdminAvailabilityRow({
    availability,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onDelete,
}: {
    availability: Availability
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: AvailabilityFormValues) => void
    onDelete: () => void
}) {
    if (isEditing) {
        return (
            <AvailabilityForm
                submitLabel="Save Changes"
                initial={{
                    dayOfWeek: availability.dayOfWeek,
                    startTime: availability.startTime,
                    endTime: availability.endTime,
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <span className="font-medium text-surface-foreground">{DAY_NAMES[availability.dayOfWeek]}</span>
                <p className="mt-1 text-sm text-muted-foreground">
                    {availability.startTime} &ndash; {availability.endTime}
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