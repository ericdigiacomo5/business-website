import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

// One booking inside the time off being saved — the shape the time-off
// routes return in a 409 (TimeOffConflict in src/lib/time-off-conflicts.ts,
// restated here because that module imports Prisma).
export type TimeOffConflict = {
    id: string
    startTime: string
    endTime: string
    customerName: string
    artistName: string
    services: string
}

// Shown when saving time off would land on existing bookings: lists them,
// and the admin either goes back (nothing saved, the form keeps its values)
// or cancels them all and saves. Same centered-modal shell as the schedule's
// sheets.
export function TimeOffConflictsDialog({
    conflicts,
    salonWide,
    saving,
    onGoBack,
    onCancelAll,
}: {
    conflicts: TimeOffConflict[]
    // Salon-wide time off can hit several artists, so each row names one.
    salonWide: boolean
    saving: boolean
    onGoBack: () => void
    onCancelAll: () => void
}) {
    const goBackRef = useRef<HTMLButtonElement>(null)
    // The latest handler, so the listener below is attached once (and focus
    // moved once) rather than on every parent render.
    const onGoBackRef = useRef(onGoBack)
    useEffect(() => {
        onGoBackRef.current = onGoBack
    }, [onGoBack])

    // Focus starts on the safe choice, and Escape means "go back".
    useEffect(() => {
        goBackRef.current?.focus()
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onGoBackRef.current()
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    const count = conflicts.length

    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-foreground/40 p-4">
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="timeoff-conflicts-title"
                aria-describedby="timeoff-conflicts-description"
                className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-background px-4 pt-4 pb-6 shadow-lg"
            >
                <h2 id="timeoff-conflicts-title" className="font-medium text-foreground">
                    {count} booking{count === 1 ? "" : "s"} in this time off
                </h2>
                <p id="timeoff-conflicts-description" className="mt-1 text-sm text-muted-foreground">
                    {`Saving this time off will cancel ${count === 1 ? "this appointment" : `these ${count} appointments`}. Customers with a confirmed email are told the salon cancelled. Go back to change the time off instead.`}
                </p>

                <ul className="mt-4 flex flex-col gap-2">
                    {conflicts.map((conflict) => (
                        <li key={conflict.id} className="rounded-lg border border-line bg-surface shadow-sm p-3 text-sm">
                            <p className="font-medium text-surface-foreground">
                                {new Date(conflict.startTime).toLocaleString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                                {" – "}
                                {new Date(conflict.endTime).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                                {salonWide
                                    ? `${conflict.customerName} · ${conflict.services} · ${conflict.artistName}`
                                    : `${conflict.customerName} · ${conflict.services}`}
                            </p>
                        </li>
                    ))}
                </ul>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Button ref={goBackRef} variant="secondary" onClick={onGoBack} disabled={saving} className="sm:flex-1">
                        Go Back
                    </Button>
                    <Button variant="danger" onClick={onCancelAll} disabled={saving} className="sm:flex-1">
                        {saving ? "Cancelling..." : count === 1 ? "Cancel It & Save" : `Cancel All ${count} & Save`}
                    </Button>
                </div>
            </div>
        </div>
    )
}
