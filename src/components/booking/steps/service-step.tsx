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
            <h2 className="font-serif text-xl font-bold text-foreground">Choose a Service</h2>
            <p className="mt-1 text-sm text-muted-foreground">Step 1 of 4</p>
            <div className="mt-5 flex flex-col gap-3.5">
                {services.map((service) => {
                    const selected = service.id === selectedId
                    return (
                        <button
                            key={service.id}
                            type="button"
                            onClick={() => onSelect(service.id)}
                            className={
                                "group flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-sm p-5 text-left transition-colors " +
                                (selected
                                    ? "border-2 border-accent bg-background"
                                    : "border border-foreground bg-surface hover:bg-muted")
                            }
                        >
                            <span>
                                <span className="block font-serif text-base font-bold text-surface-foreground">
                                    {service.name}
                                </span>
                                <span className="mt-0.5 block text-sm text-muted-foreground">
                                    {formatDuration(service.durationMinutes)}
                                </span>
                            </span>
                            <span className="flex items-center gap-3.5">
                                <span className="font-serif text-lg font-bold text-accent">
                                    {formatPrice(service.priceCents)}
                                </span>
                                <span
                                    className={
                                        "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-colors " +
                                        (selected
                                            ? "border-accent bg-accent"
                                            : "border-muted-foreground group-hover:border-accent")
                                    }
                                >
                                    <span
                                        className={
                                            "h-2 w-2 rounded-full transition-colors " +
                                            (selected
                                                ? "bg-background"
                                                : "bg-transparent group-hover:bg-accent")
                                        }
                                    />
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
