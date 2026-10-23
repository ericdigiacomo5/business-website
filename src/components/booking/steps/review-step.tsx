'use client'

import { useState } from "react"
import { useSession } from "next-auth/react"
import type { Artist, Service } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { StickyActionBar } from "@/components/ui/sticky-action-bar"
import { ResendVerificationButton } from "@/components/auth/resend-verification-button"
import { formatDuration, formatPrice, toLocalDateKey, toLocalTimeKey } from "@/lib/format"
import { maxSeriesEnd } from "@/lib/recurring"
import { EMAIL_UNVERIFIED_MESSAGE, PROFILE_INCOMPLETE_MESSAGE } from "@/lib/validation"
import { appointmentLengthOptions } from "@/lib/schedule-grid"
import { formatSalonDateTime, salonWeekday } from "@/lib/salon-time"
import type { BookedAppointment, RecurringBookingResult } from "../wizard-state"

const INTERVAL_OPTIONS = [
    { weeks: 1, label: "Weekly" },
    { weeks: 2, label: "Every 2 weeks" },
    { weeks: 3, label: "Every 3 weeks" },
    { weeks: 4, label: "Every 4 weeks" },
]

export function ReviewStep({
    services,
    artist,
    startTime,
    userLabel,
    adminMode = false,
    targetUserId,
    inline = false,
    slotUnavailableMessage = "That time was just taken — please pick another.",
    maxSeriesWeeks,
    profileIncomplete = false,
    emailUnverified = false,
    onCompleteProfile,
    onBack,
    onSuccess,
    onRecurringSuccess,
    onSlotUnavailable,
    onUnauthenticated,
}: {
    // One or more, in the order they were picked.
    services: Service[]
    artist: Artist
    startTime: string
    userLabel: string
    // Set together by the admin schedule grid: book on behalf of
    // targetUserId instead of the signed-in user. The server only honors
    // userId for an ADMIN session, so this is a convenience, not the gate.
    adminMode?: boolean
    targetUserId?: string
    // Render the actions in normal flow instead of the viewport-fixed bar —
    // for use inside a modal, where a fixed bar would sit behind the overlay.
    inline?: boolean
    slotUnavailableMessage?: string
    // The salon's current standing-appointment cap (AppSettings), from the
    // server page — sets the end date picker's max.
    maxSeriesWeeks: number
    // Customer only: the signed-in user has no name or phone on file. The
    // server refuses their booking until fixed, so offer the fix instead of
    // a Confirm button that can only fail.
    profileIncomplete?: boolean
    // Customer only: the account's email isn't confirmed yet — same idea:
    // offer the resend link instead of a Confirm the server will refuse.
    emailUnverified?: boolean
    onCompleteProfile?: () => void
    onBack: () => void
    onSuccess: (appointment: BookedAppointment) => void
    onRecurringSuccess: (result: RecurringBookingResult) => void
    onSlotUnavailable: () => void
    onUnauthenticated: () => void
}) {
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const ActionBar = inline ? "div" : StickyActionBar
    const { update: refreshSession } = useSession()
    // Admins booking for someone else are never blocked by their own profile.
    // Email first: it's the one the customer has to leave the page for.
    const mustVerifyEmail = !adminMode && emailUnverified
    const mustCompleteProfile = !adminMode && !mustVerifyEmail && profileIncomplete && onCompleteProfile !== undefined

    const serviceIds = services.map((service) => service.id)
    const usualMinutes = services.reduce((sum, service) => sum + service.durationMinutes, 0)
    const priceCents = services.reduce((sum, service) => sum + service.priceCents, 0)

    // Kept as local state rather than wizard-reducer state: it doesn't need
    // to survive the unauthenticated-mid-review -> login -> rehydrate round
    // trip the way service/artist/date/time do, since that redirect fires
    // immediately on reaching review while signed out (before this step, or
    // this toggle, ever renders) — the only way to lose it is a session that
    // expires in the narrow window between toggling this and clicking
    // Confirm, which just means re-toggling after signing back in.
    const [isRecurring, setIsRecurring] = useState(false)
    // Admin only, one-off only: this client's appointment can be booked
    // longer or shorter than its services usually take. A standing
    // appointment books every visit at the usual length; a single visit's
    // length can be changed afterward from the schedule.
    const [lengthMinutes, setLengthMinutes] = useState(usualMinutes)
    const canSetLength = adminMode && !isRecurring
    const bookedMinutes = canSetLength ? lengthMinutes : usualMinutes
    const [intervalWeeks, setIntervalWeeks] = useState(1)
    const [seriesEnd, setSeriesEnd] = useState("")

    async function handleConfirm() {
        setError(null)

        if (isRecurring && !seriesEnd) {
            setError("Choose an end date for the standing appointment.")
            return
        }

        setPending(true)

        try {
            const res = isRecurring
                ? await fetch("/api/appointments/recurring", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                          artistId: artist.id,
                          serviceIds,
                          dayOfWeek: salonWeekday(new Date(startTime)),
                          startTime: toLocalTimeKey(new Date(startTime)),
                          intervalWeeks,
                          seriesStart: toLocalDateKey(new Date(startTime)),
                          seriesEnd,
                          ...(adminMode && targetUserId ? { userId: targetUserId } : {}),
                      }),
                  })
                : await fetch("/api/appointments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                          artistId: artist.id,
                          serviceIds,
                          startTime,
                          ...(adminMode && targetUserId ? { userId: targetUserId } : {}),
                          ...(bookedMinutes !== usualMinutes ? { durationMinutes: bookedMinutes } : {}),
                      }),
                  })

            if (res.status === 201) {
                const body = await res.json()
                if (isRecurring) {
                    onRecurringSuccess(body.data as RecurringBookingResult)
                } else {
                    onSuccess(body.data as BookedAppointment)
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
                setError(slotUnavailableMessage)
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
        <div className={inline ? undefined : "pb-28"}>
            <h2 className="text-lg font-semibold text-foreground">Review &amp; Confirm</h2>

            <dl className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
                <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-sm text-muted-foreground">{services.length === 1 ? "Service" : "Services"}</dt>
                    <dd className="text-right text-sm font-medium text-surface-foreground">
                        {services.map((service) => (
                            <span key={service.id} className="block">
                                {service.name}
                                {services.length > 1 && (
                                    <span className="font-normal text-muted-foreground">
                                        {" "}
                                        &middot; {formatPrice(service.priceCents)}
                                    </span>
                                )}
                            </span>
                        ))}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Artist</dt>
                    <dd className="text-sm font-medium text-surface-foreground">{artist.name}</dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">When</dt>
                    <dd className="text-sm font-medium text-surface-foreground">
                        {formatSalonDateTime(startTime, {
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
                        {canSetLength ? (
                            <select
                                aria-label="Appointment length"
                                value={lengthMinutes}
                                onChange={(e) => setLengthMinutes(Number(e.target.value))}
                                className="h-11 rounded-sm border border-border bg-background px-2 text-sm text-foreground"
                            >
                                {appointmentLengthOptions(usualMinutes).map((minutes) => (
                                    <option key={minutes} value={minutes}>
                                        {formatDuration(minutes)}
                                        {minutes === usualMinutes ? " (usual)" : ""}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            formatDuration(usualMinutes)
                        )}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">{services.length === 1 ? "Price" : "Total"}</dt>
                    <dd className="text-sm font-medium text-surface-foreground">
                        {formatPrice(priceCents)}
                    </dd>
                </div>
                <div className="flex justify-between px-4 py-3">
                    <dt className="text-sm text-muted-foreground">Booking as</dt>
                    <dd className="text-sm font-medium text-surface-foreground">{userLabel}</dd>
                </div>
            </dl>

            <div className="mt-4 rounded-xl border border-line bg-surface p-4 shadow-card">
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
                                className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
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
                                End date
                            </label>
                            <input
                                id="series-end"
                                type="date"
                                value={seriesEnd}
                                required
                                min={toLocalDateKey(new Date(startTime))}
                                max={toLocalDateKey(maxSeriesEnd(new Date(startTime), maxSeriesWeeks))}
                                onChange={(e) => setSeriesEnd(e.target.value)}
                                className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Required — up to {maxSeriesWeeks} weeks out.
                            </p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            We&apos;ll book every visit through your end date now, and let you know if any
                            date can&apos;t be booked.
                        </p>
                    </div>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-4 text-sm text-danger">
                    {error}
                </p>
            )}

            {mustVerifyEmail && (
                <div role="status" className="mt-4 rounded-sm border border-accent bg-surface p-4 text-sm text-surface-foreground">
                    <p>
                        {EMAIL_UNVERIFIED_MESSAGE} Once you&apos;ve clicked it, come back here and choose
                        &ldquo;I&apos;ve Confirmed&rdquo; — your selections will be kept.
                    </p>
                    <ResendVerificationButton />
                </div>
            )}

            {mustCompleteProfile && (
                <p role="status" className="mt-4 rounded-sm border border-accent bg-surface p-4 text-sm text-surface-foreground">
                    {PROFILE_INCOMPLETE_MESSAGE} Your selections will be kept.
                </p>
            )}

            <ActionBar className={inline ? "mt-4 flex items-center gap-3" : "flex items-center gap-3"}>
                <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
                    Back
                </Button>
                {mustVerifyEmail ? (
                    // Re-reads the session (the jwt callback re-checks the
                    // database), so a link clicked in another tab or on a
                    // phone unlocks this step.
                    <Button type="button" onClick={() => refreshSession({})} className="flex-1">
                        I&apos;ve Confirmed
                    </Button>
                ) : mustCompleteProfile ? (
                    <Button type="button" onClick={onCompleteProfile} className="flex-1">
                        Complete Profile
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={pending}
                        className="flex-1"
                    >
                        {pending ? "Booking..." : "Confirm Booking"}
                    </Button>
                )}
            </ActionBar>
        </div>
    )
}
