export function SlotGrid({
    slots,
    selectedTime,
    onSelect,
}: {
    slots: string[]
    selectedTime: string | null
    onSelect: (isoTime: string) => void
}) {
    if (slots.length === 0) {
        return <p className="mt-4 text-sm text-muted-foreground">No open times on this day.</p>
    }

    return (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
                const selected = slot === selectedTime
                return (
                    <button
                        key={slot}
                        type="button"
                        onClick={() => onSelect(slot)}
                        className={
                            "min-h-11 rounded-lg border text-sm font-medium transition-colors " +
                            (selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-surface text-surface-foreground hover:bg-muted")
                        }
                    >
                        {new Date(slot).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </button>
                )
            })}
        </div>
    )
}
