'use client'

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { useToast } from "@/components/ui/toast"

export function BookingToggle({ initialEnabled }: { initialEnabled: boolean }) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const toast = useToast()

    async function handleToggle() {
        setError(null)
        setPending(true)

        try {
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingEnabled: !enabled }),
            })

            const body = await res.json().catch(() => null)

            if (!res.ok) {
                setError(body?.error ?? "Something went wrong. Please try again.")
                return
            }

            setEnabled(body.data.bookingEnabled)
            toast(body.data.bookingEnabled ? "Online booking is open." : "Online booking is closed.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-surface-foreground">Customer Self-Booking</span>
                    <Badge tone={enabled ? "success" : "danger"}>{enabled ? "Open" : "Closed"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {enabled
                        ? "Customers can book their own appointments online."
                        : "Customers cannot book online right now. Staff can still book on their behalf."}
                </p>
                {error && (
                    <p role="alert" className="mt-1 text-sm text-danger">
                        {error}
                    </p>
                )}
            </div>

            {/* Closing turns every customer away, so it asks first;
                reopening doesn't. */}
            <div className="shrink-0">
                {enabled ? (
                    <ConfirmAction
                        label="Close Booking"
                        prompt="Stop customers booking online?"
                        confirmLabel="Yes, Close"
                        busy={pending}
                        busyLabel="Saving..."
                        onConfirm={handleToggle}
                    />
                ) : (
                    <Button variant="secondary" size="md" onClick={handleToggle} disabled={pending}>
                        {pending ? "Saving..." : "Reopen Booking"}
                    </Button>
                )}
            </div>
        </div>
    )
}
