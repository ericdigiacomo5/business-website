import { partOfDay } from "@/lib/schedule-grid"
import { formatSalonTime } from "@/lib/salon-time"

// Above this many times, they're grouped into Morning / Afternoon / Evening
// so a long day stays scannable (FEATURE_GAPS.md U6).
const GROUP_ABOVE = 12

export function SlotGrid({
    slots,
    selectedTime,
    onSelect,
    emptyMessage,
}: {
    slots: string[]
    selectedTime: string | null
    onSelect: (isoTime: string) => void
    // Replaces the default "No open times" line — the date step passes a
    // "Next opening" button here.
    emptyMessage?: React.ReactNode
}) {
    if (slots.length === 0) {
        return emptyMessage ?? <p className="mt-4 text-sm text-muted-foreground">No open times on this day.</p>
    }

    const groups =
        slots.length > GROUP_ABOVE
            ? (["Morning", "Afternoon", "Evening"] as const)
                  .map((part) => ({ part, slots: slots.filter((slot) => partOfDay(new Date(slot)) === part) }))
                  .filter((group) => group.slots.length > 0)
            : [{ part: null, slots }]

    return (
        <div className="mt-4 flex flex-col gap-4">
            {groups.map((group) => (
                <div key={group.part ?? "all"} role={group.part ? "group" : undefined} aria-label={group.part ?? undefined}>
                    {group.part && (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.part}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {group.slots.map((slot) => {
                            const selected = slot === selectedTime
                            return (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => onSelect(slot)}
                                    aria-pressed={selected}
                                    className={
                                        "pop-on-select min-h-11 cursor-pointer rounded-lg border text-sm font-medium transition " +
                                        (selected
                                            ? "border-lacquer bg-lacquer text-lacquer-foreground shadow-md"
                                            : "border-line bg-surface text-surface-foreground shadow-sm hover:border-foreground/40")
                                    }
                                >
                                    {formatSalonTime(slot)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
