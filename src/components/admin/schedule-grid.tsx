'use client'

import { useState } from "react"
import type { Artist, AppointmentStatus } from "@/generated/prisma/client"
import { SLOT_MINUTES, type ArtistWorkingWindow } from "@/lib/schedule-grid"
import { ScheduleTimeAxis } from "./schedule-time-axis"
import { ScheduleArtistColumn } from "./schedule-artist-column"
import { ScheduleDetailSheet } from "./schedule-detail-sheet"
import type { AdminAppointment } from "./appointment-shared"

const ROW_HEIGHT_PX = 24

export function ScheduleGrid({
    initialAppointments,
    artists,
    workingWindows,
    gridBounds,
}: {
    initialAppointments: AdminAppointment[]
    artists: Artist[]
    workingWindows: ArtistWorkingWindow[]
    gridBounds: { start: string; end: string }
}) {
    const [appointments, setAppointments] = useState(initialAppointments)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    async function updateStatus(id: string, status: AppointmentStatus) {
        setError(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that booking. Please try again.")
                return
            }

            const body = await res.json()
            setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: body.data.status } : a)))
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setBusyId(null)
        }
    }

    if (artists.length === 0) {
        return <p className="mt-8 text-muted-foreground">No artists to schedule.</p>
    }

    const usingFallbackBounds = workingWindows.every((w) => w.start === null)

    const [startHours, startMinutesPart] = gridBounds.start.split(":").map(Number)
    const [endHours, endMinutesPart] = gridBounds.end.split(":").map(Number)
    const gridStartMinutes = startHours * 60 + startMinutesPart
    const gridEndMinutes = endHours * 60 + endMinutesPart
    const totalRows = (gridEndMinutes - gridStartMinutes) / SLOT_MINUTES

    const selectedAppointment = appointments.find((a) => a.id === selectedId) ?? null

    return (
        <div className="mt-6">
            {usingFallbackBounds && (
                <p className="mb-3 text-sm text-muted-foreground">
                    No working hours are set for this date — showing a default 9am–5pm range.
                </p>
            )}

            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="-mx-4 overflow-x-auto px-4">
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `64px repeat(${artists.length}, minmax(112px, 1fr))`,
                        gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
                    }}
                >
                    <ScheduleTimeAxis gridStartMinutes={gridStartMinutes} totalRows={totalRows} />

                    {artists.map((artist, index) => {
                        const workingWindow = workingWindows.find((w) => w.artistId === artist.id) ?? {
                            artistId: artist.id,
                            start: null,
                            end: null,
                        }

                        // appointments is already scoped to the single selected day by
                        // the page's own Prisma query (where.startTime between day
                        // bounds) — no date filtering needed here, just by artist.
                        const artistAppointments = appointments.filter((a) => a.artistId === artist.id)

                        return (
                            <ScheduleArtistColumn
                                key={artist.id}
                                artist={artist}
                                columnIndex={index}
                                workingWindow={workingWindow}
                                appointments={artistAppointments}
                                gridStartMinutes={gridStartMinutes}
                                totalRows={totalRows}
                                onSelect={setSelectedId}
                            />
                        )
                    })}
                </div>
            </div>

            <ScheduleDetailSheet
                appointment={selectedAppointment}
                busy={busyId === selectedId}
                onConfirm={() => selectedId && updateStatus(selectedId, "CONFIRMED")}
                onComplete={() => selectedId && updateStatus(selectedId, "COMPLETED")}
                onCancel={() => selectedId && updateStatus(selectedId, "CANCELLED")}
                onClose={() => setSelectedId(null)}
            />
        </div>
    )
}
