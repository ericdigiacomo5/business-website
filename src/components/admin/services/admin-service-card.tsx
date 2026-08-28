import type { Service } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { ServiceForm, type ServiceFormValues } from "./service-form"

export function AdminServiceCard({
    service,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onToggleActive,
}: {
    service: Service
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: ServiceFormValues) => void
    onToggleActive: () => void
}) {
    if (isEditing) {
        return (
            <ServiceForm
                submitLabel="Save Changes"
                initial={{
                    name: service.name,
                    description: service.description ?? "",
                    durationMinutes: service.durationMinutes,
                    priceCents: service.priceCents,
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">{service.name}</span>
                    <Badge tone={service.active ? "success" : "muted"}>
                        {service.active ? "Active" : "Inactive"}
                    </Badge>
                </div>
                {service.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                    {formatDuration(service.durationMinutes)} &middot; {formatPrice(service.priceCents)}
                </p>
            </div>

            <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="md" onClick={onEdit}>
                    Edit
                </Button>
                <Button variant={service.active ? "danger" : "secondary"} size="md" onClick={onToggleActive}>
                    {service.active ? "Deactivate" : "Reactivate"}
                </Button>
            </div>
        </div>
    )
}