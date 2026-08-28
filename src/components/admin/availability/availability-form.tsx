import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

export type AvailabilityFormValues = {
    dayOfWeek: number
    startTime: string
    endTime: string
}

// Index matches Date.getDay() (0 = Sunday), same convention used throughout
// this project (see PROJECT_STATUS.md).
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function AvailabilityForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial?: AvailabilityFormValues
    submitLabel: string
    onSubmit: (values: AvailabilityFormValues) => void
    onCancel: () => void
}) {
    const [dayOfWeek, setDayOfWeek] = useState(String(initial?.dayOfWeek ?? 2))
    const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00")
    const [endTime, setEndTime] = useState(initial?.endTime ?? "17:00")

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit({ dayOfWeek: Number(dayOfWeek), startTime, endTime })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <div>
                <label htmlFor="availability-day" className="block text-xs font-medium text-muted-foreground">
                    Day of Week
                </label>
                <select
                    id="availability-day"
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                >
                    {DAY_NAMES.map((name, index) => (
                        <option key={name} value={index}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="availability-start" className="block text-xs font-medium text-muted-foreground">
                        Start Time
                    </label>
                    <input
                        id="availability-start"
                        type="time"
                        step={900}
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    />
                </div>

                <div className="flex-1">
                    <label htmlFor="availability-end" className="block text-xs font-medium text-muted-foreground">
                        End Time
                    </label>
                    <input
                        id="availability-end"
                        type="time"
                        step={900}
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
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