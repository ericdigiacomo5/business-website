'use client'

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function BookingToggle({ initialEnabled }: { initialEnabled: boolean }) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
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

            <Button
                variant={enabled ? "danger" : "secondary"}
                size="md"
                onClick={handleToggle}
                disabled={pending}
                className="shrink-0"
            >
                {pending ? "Saving..." : enabled ? "Close Booking" : "Reopen Booking"}
            </Button>
        </div>
    )
}
