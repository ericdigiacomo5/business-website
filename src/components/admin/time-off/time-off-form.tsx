import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { toLocalDateKey } from "@/lib/format"

export type TimeOffFormValues = {
    date: string
    endDate: string | null
    startTime: string
    endTime: string
}

export function TimeOffForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial?: TimeOffFormValues
    submitLabel: string
    onSubmit: (values: TimeOffFormValues) => void
    onCancel: () => void
}) {
    const [date, setDate] = useState(initial?.date ?? toLocalDateKey(new Date()))
    // Multi-day is opt-in via a checkbox rather than always showing a second
    // date field — defaults off so the common single-day case (today's
    // behavior) needs zero extra clicks. Starting checked when editing an
    // entry that already has an endDate keeps that state visible on open.
    const [isRange, setIsRange] = useState(initial?.endDate != null)
    const [endDate, setEndDate] = useState(initial?.endDate ?? "")
    const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00")
    const [endTime, setEndTime] = useState(initial?.endTime ?? "17:00")

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit({ date, endDate: isRange && endDate ? endDate : null, startTime, endTime })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-4">
            <div>
                <label htmlFor="timeoff-date" className="block text-xs font-medium text-muted-foreground">
                    {isRange ? "Start Date" : "Date"}
                </label>
                <input
                    id="timeoff-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                    type="checkbox"
                    checked={isRange}
                    onChange={(e) => setIsRange(e.target.checked)}
                    className="h-4 w-4"
                />
                Multi-day range
            </label>

            {isRange && (
                <div>
                    <label htmlFor="timeoff-end-date" className="block text-xs font-medium text-muted-foreground">
                        End Date
                    </label>
                    <input
                        id="timeoff-end-date"
                        type="date"
                        required
                        min={date}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                    />
                </div>
            )}

            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="timeoff-start" className="block text-xs font-medium text-muted-foreground">
                        Start Time
                    </label>
                    <input
                        id="timeoff-start"
                        type="time"
                        step={900}
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                    />
                </div>

                <div className="flex-1">
                    <label htmlFor="timeoff-end" className="block text-xs font-medium text-muted-foreground">
                        End Time
                    </label>
                    <input
                        id="timeoff-end"
                        type="time"
                        step={900}
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <Button type="submit">{submitLabel}</Button>
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}