'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { POLICY_LIMITS, describeNoticeWindow, type PolicySettings } from "@/lib/recurring"

// The two salon policies that used to be hardcoded: how close to an
// appointment a customer can still cancel/reschedule online, and the longest
// a standing appointment may run. Admins are never limited by either.
export function PolicySettingsForm({ initial }: { initial: PolicySettings }) {
    const [saved, setSaved] = useState(initial)
    const [noticeHours, setNoticeHours] = useState(String(initial.cancellationNoticeHours))
    const [seriesWeeks, setSeriesWeeks] = useState(String(initial.maxSeriesWeeks))
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const toast = useToast()

    const dirty =
        noticeHours !== String(saved.cancellationNoticeHours) || seriesWeeks !== String(saved.maxSeriesWeeks)

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        try {
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cancellationNoticeHours: Number(noticeHours),
                    maxSeriesWeeks: Number(seriesWeeks),
                }),
            })

            const body = await res.json().catch(() => null)

            if (!res.ok) {
                setError(body?.error ?? "Something went wrong. Please try again.")
                return
            }

            const next: PolicySettings = {
                cancellationNoticeHours: body.data.cancellationNoticeHours,
                maxSeriesWeeks: body.data.maxSeriesWeeks,
            }
            setSaved(next)
            setNoticeHours(String(next.cancellationNoticeHours))
            setSeriesWeeks(String(next.maxSeriesWeeks))
            toast("Booking policies saved.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    const inputClass = "mt-1 h-11 w-28 rounded-sm border border-border bg-background px-3 text-sm text-foreground"

    return (
        <form
            onSubmit={handleSave}
            className="flex flex-col gap-4 rounded-lg border border-line bg-surface shadow-sm p-4"
        >
            <div>
                <span className="font-medium text-surface-foreground">Booking Policies</span>
                <p className="mt-1 text-sm text-muted-foreground">
                    Customers can cancel or reschedule online up to{" "}
                    {describeNoticeWindow(saved.cancellationNoticeHours)} before an appointment, and book standing
                    appointments up to {saved.maxSeriesWeeks} weeks long. Staff are never limited by these.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs font-medium text-muted-foreground">
                    Cancellation notice (hours)
                    <input
                        type="number"
                        inputMode="numeric"
                        min={POLICY_LIMITS.cancellationNoticeHours.min}
                        max={POLICY_LIMITS.cancellationNoticeHours.max}
                        step={1}
                        required
                        value={noticeHours}
                        onChange={(e) => setNoticeHours(e.target.value)}
                        className={`block ${inputClass}`}
                    />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                    Longest standing appointment (weeks)
                    <input
                        type="number"
                        inputMode="numeric"
                        min={POLICY_LIMITS.maxSeriesWeeks.min}
                        max={POLICY_LIMITS.maxSeriesWeeks.max}
                        step={1}
                        required
                        value={seriesWeeks}
                        onChange={(e) => setSeriesWeeks(e.target.value)}
                        className={`block ${inputClass}`}
                    />
                </label>
                <Button type="submit" variant="secondary" size="md" disabled={pending || !dirty}>
                    {pending ? "Saving..." : "Save"}
                </Button>
            </div>

            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
        </form>
    )
}
