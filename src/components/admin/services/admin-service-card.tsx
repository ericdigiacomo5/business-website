import type { Service } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"
import { SERVICE_CATEGORY_LABEL } from "@/lib/service-category"
import { ServiceForm, type ServiceFormValues } from "./service-form"

// payTerms: the fee charged to the artist (admin-only data, see
// ServicePayTerms); null = no fee.
export type AdminService = Service & { payTerms: { serviceFeeCents: number } | null }

export function AdminServiceCard({
    service,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onToggleActive,
}: {
    service: AdminService
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
                    category: service.category,
                    durationMinutes: service.durationMinutes,
                    priceCents: service.priceCents,
                    serviceFeeCents: service.payTerms?.serviceFeeCents ?? 0,
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
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
                    {SERVICE_CATEGORY_LABEL[service.category]} &middot;{" "}
                    {formatDuration(service.durationMinutes)} &middot; {formatPrice(service.priceCents)}
                </p>
                {service.payTerms && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {`Service fee ${formatPrice(service.payTerms.serviceFeeCents)} (charged to the artist)`}
                    </p>
                )}
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