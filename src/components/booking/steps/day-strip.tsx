import { toLocalDateKey } from "@/lib/format"

export function DayStrip({
    days,
    selectedDate,
    onSelect,
}: {
    days: Date[]
    selectedDate: string | null
    onSelect: (dateKey: string) => void
}) {
    return (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {days.map((day) => {
                const key = toLocalDateKey(day)
                const selected = key === selectedDate
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        className={
                            "flex h-16 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-sm border text-sm transition-colors " +
                            (selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-surface text-surface-foreground hover:bg-muted")
                        }
                    >
                        <span className="text-xs uppercase opacity-80">
                            {day.toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        <span className="text-base font-semibold">{day.getDate()}</span>
                    </button>
                )
            })}
        </div>
    )
}
