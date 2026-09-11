'use client'

import { useState } from "react"
import type { Appointment, Artist, Service } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { StickyActionBar } from "@/components/ui/sticky-action-bar"
import { formatDuration, formatPrice, toLocalDateKey, toLocalTimeKey } from "@/lib/format"
import { MATERIALIZE_WEEKS } from "@/lib/recurring"
import type { RecurringBookingResult } from "../wizard-state"

const INTERVAL_OPTIONS = [
    { weeks: 1, label: "Weekly" },
    { weeks: 2, label: "Every 2 weeks" },
    { weeks: 3, label: "Every 3 weeks" },
    { weeks: 4, label: "Every 4 weeks" },
]

export function ReviewStep({
    service,
    artist,
    startTime,
    userLabel,
    adminMode = false,
    targetUserId,
    onBack,
    onSuccess,
    onRecurringSuccess,
    onSlotUnavailable,
    onUnauthenticated,
}: {
    service: Service
    artist: Artist
    startTime: string
    userLabel: string
    adminMode?: boolean
    targetUserId?: string
    onBack: () => void
    onSuccess: (appointment: Appointment) => void
    onRecurringSuccess: (result: RecurringBookingResult) => void
    onSlotUnavailable: () => void
    onUnauthenticated: () => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    // Kept as local state rather than wizard-reducer state: it doesn't need
    // to survive the unauthenticated-mid-review -> login -> rehydrate round
    // trip the way service/artist/date/time do, since that redirect fires
    // immediately on reaching review while signed out (before this step, or
    // this toggle, ever renders) — the only way to lose it is a session that
    // expires in the narrow window between toggling this and clicking
    // Confirm, which just means re-toggling after signing back in.
    const [isRecurring, setIsRecurring] = useState(false)
    const [intervalWeeks, setIntervalWeeks] = useState(1)
    const [seriesEnd, setSeriesEnd] = useState("")

    async function handleConfirm() {
        setError(null)
        setPending(true)

        try {
            const res = isRecurring
                ? await fetch("/api/appointments/recurring", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                          artistId: artist.id,
                          serviceId: service.id,
                          dayOfWeek: new Date(startTime).getDay(),
                          startTime: toLocalTimeKey(new Date(startTime)),
                          intervalWeeks,
                          seriesStart: toLocalDateKey(new Date(startTime)),
                          seriesEnd: seriesEnd || undefined,
                          ...(adminMode && targetUserId ? { userId: targetUserId } : {}),
                      }),
                  })
                : await fetch("/api/appointments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                          artistId: artist.id,
                          serviceId: service.id,
                          startTime,
                          ...(adminMode && targetUserId ? { userId: targetUserId } : {}),
                      }),
                  })

            if (res.status === 201) {
                const body = await res.json()
                if (isRecurring) {
                    onRecurringSuccess(body.data as RecurringBookingResult)
                } else {
                    onSuccess(body.data as Appointment)
                }
                return
            }

            if (res.status === 401) {
                onUnauthenticated()
                return
            }

            const body = await res.json().catch(() => null)
            const message: string | undefined = body?.error

            if (message === "That time is not available" || res.status === 409) {
                onSlotUnavailable()
                setError("That time was just taken — please pick another.")
                return
            }

            setError(message ?? "Something went wrong. Please try again.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="pb-28">
            <h2 className="text-lg font-semibold text-foreground">Review &amp; Confirm</h2>

            <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Service</dt>
                    <dd className="text-sm font-medium text-surface-foreground">{service.name}</dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Artist</dt>
                    <dd className="text-sm font-medium text-surface-foreground">{artist.name}</dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">When</dt>
                    <dd className="text-sm font-medium text-surface-foreground">
                        {new Date(startTime).toLocaleString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                        })}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Duration</dt>
                    <dd className="text-sm font-medium text-surface-foreground">
                        {formatDuration(service.durationMinutes)}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Price</dt>
                    <dd className="text-sm font-medium text-surface-foreground">
                        {formatPrice(service.priceCents)}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Booking as</dt>
                    <dd className="text-sm font-medium text-surface-foreground">{userLabel}</dd>
                </div>
            </dl>

            <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="h-5 w-5 rounded border-border"
                    />
                    <span className="text-sm font-medium text-surface-foreground">
                        Make this a standing appointment
                    </span>
                </label>

                {isRecurring && (
                    <div className="mt-4 flex flex-col gap-4">
                        <div>
                            <label htmlFor="interval-weeks" className="block text-xs font-medium text-muted-foreground">
                                Repeats
                            </label>
                            <select
                                id="interval-weeks"
                                value={intervalWeeks}
                                onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                                className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                            >
                                {INTERVAL_OPTIONS.map((option) => (
                                    <option key={option.weeks} value={option.weeks}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="series-end" className="block text-xs font-medium text-muted-foreground">
                                End date (optional)
                            </label>
                            <input
                                id="series-end"
                                type="date"
                                value={seriesEnd}
                                min={toLocalDateKey(new Date(startTime))}
                                onChange={(e) => setSeriesEnd(e.target.value)}
                                className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Leave blank to repeat with no set end.
                            </p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            We&apos;ll book your next {MATERIALIZE_WEEKS} weeks right away.
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-4 text-sm text-danger">
                    {error}
                </p>
            )}

            <StickyActionBar className="flex items-center gap-3">
                <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
                    Back
                </Button>
                <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={pending}
                    className="flex-1"
                >
                    {pending ? "Booking..." : "Confirm Booking"}
                </Button>
            </StickyActionBar>
        </div>
    )
}
