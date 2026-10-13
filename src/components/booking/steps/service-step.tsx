import { Check } from "lucide-react"
import type { Service } from "@/generated/prisma/client"
import { formatDuration, formatPrice } from "@/lib/format"
import { MAX_SERVICES_PER_APPOINTMENT } from "@/lib/appointment-services"

// Pick one or more services. Selecting doesn't advance — the caller renders
// its own Continue button — because an appointment can hold several.
export function ServiceStep({
    services,
    selectedIds,
    subtitle = "Step 1 of 4",
    onToggle,
}: {
    services: Service[]
    selectedIds: string[]
    // null hides it — the admin schedule grid reuses this list outside the
    // four-step customer wizard.
    subtitle?: string | null
    onToggle: (serviceId: string) => void
}) {
    const chosen = selectedIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is Service => service !== undefined)
    const atLimit = selectedIds.length >= MAX_SERVICES_PER_APPOINTMENT

    return (
        <div>
            <h2 className="font-serif text-xl font-bold text-foreground">Choose Your Services</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <p className="mt-1 text-sm text-muted-foreground">Pick one or more.</p>
            <div className="mt-5 flex flex-col gap-3.5">
                {services.map((service) => {
                    const selected = selectedIds.includes(service.id)
                    return (
                        <button
                            key={service.id}
                            type="button"
                            role="checkbox"
                            aria-checked={selected}
                            disabled={!selected && atLimit}
                            onClick={() => onToggle(service.id)}
                            className={
                                "group flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-sm p-5 text-left transition-colors " +
                                "disabled:cursor-not-allowed disabled:opacity-50 " +
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
                                        "flex h-5 w-5 flex-none items-center justify-center rounded-sm border-2 transition-colors " +
                                        (selected
                                            ? "border-accent bg-accent text-background"
                                            : "border-muted-foreground group-hover:border-accent")
                                    }
                                >
                                    {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>

            {chosen.length > 0 && (
                <p role="status" className="mt-4 text-sm font-medium text-foreground">
                    {chosen.length} selected &middot;{" "}
                    {formatDuration(chosen.reduce((sum, service) => sum + service.durationMinutes, 0))} &middot;{" "}
                    {formatPrice(chosen.reduce((sum, service) => sum + service.priceCents, 0))}
                </p>
            )}
        </div>
    )
}
