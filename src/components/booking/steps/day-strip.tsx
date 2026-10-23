import { toLocalDateKey } from "@/lib/format"
import { formatSalonDate, zonedParts } from "@/lib/salon-time"

export function DayStrip({
    days,
    selectedDate,
    openDays,
    onSelect,
}: {
    days: Date[]
    selectedDate: string | null
    // Days with at least one time that fits (FEATURE_GAPS.md U6); the rest
    // are greyed out and can't be picked. null while it loads, or if it
    // couldn't be loaded — then every day stays pickable, as before.
    openDays: Set<string> | null
    onSelect: (dateKey: string) => void
}) {
    return (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {days.map((day) => {
                const key = toLocalDateKey(day)
                const selected = key === selectedDate
                const full = openDays !== null && !openDays.has(key)
                const label = formatSalonDate(day, { weekday: "long", month: "long", day: "numeric" })
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        disabled={full}
                        aria-pressed={selected}
                        aria-label={full ? `${label}, no openings` : label}
                        className={
                            "pop-on-select flex h-16 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border text-sm transition " +
                            "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-60 " +
                            (selected
                                ? "border-lacquer bg-lacquer text-lacquer-foreground shadow-md"
                                : "border-line bg-surface text-surface-foreground shadow-sm hover:border-foreground/40")
                        }
                    >
                        <span className="text-xs uppercase opacity-80">
                            {formatSalonDate(day, { weekday: "short" })}
                        </span>
                        <span className={"text-base font-semibold " + (full ? "line-through" : "")}>{zonedParts(day).day}</span>
                    </button>
                )
            })}
        </div>
    )
}
