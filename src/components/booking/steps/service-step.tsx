import type { Service } from "@/generated/prisma/client"
import { formatDuration, formatPrice } from "@/lib/format"

export function ServiceStep({
    services,
    selectedId,
    onSelect,
}: {
    services: Service[]
    selectedId: string | null
    onSelect: (serviceId: string) => void
}) {
    return (
        <div>
            <h2 className="text-lg font-semibold text-foreground">Choose a Service</h2>
            <div className="mt-4 flex flex-col gap-3">
                {services.map((service) => {
                    const selected = service.id === selectedId
                    return (
                        <button
                            key={service.id}
                            type="button"
                            onClick={() => onSelect(service.id)}
                            className={
                                "flex min-h-11 flex-col rounded-xl border p-4 text-left transition-colors " +
                                (selected
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-surface hover:bg-muted")
                            }
                        >
                            <span className="font-medium text-surface-foreground">{service.name}</span>
                            <span className="mt-1 text-sm text-muted-foreground">
                                {formatDuration(service.durationMinutes)} &middot; {formatPrice(service.priceCents)}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
