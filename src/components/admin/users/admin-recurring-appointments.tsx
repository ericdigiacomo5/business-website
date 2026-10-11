'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { RecurringStatus } from "@/generated/prisma/client"
import {
    RecurringSeriesRow,
    describeResume,
    type RecurringAppointmentWithRelations,
    type SeriesConfirmation,
} from "@/components/recurring/recurring-series-row"
import { adminRebookUrl } from "@/components/recurring/admin-rebook-url"

// Unlike the appointment-history list on the same page (a direct Prisma
// read in the Server Component), this list is fetched client-side — the
// moment a list needs a local "after I click this button, update in place"
// story, this project's established pattern is Client Component + fetch(),
// same as every other admin CRUD page.
export function AdminRecurringAppointments({ userId }: { userId: string }) {
    const router = useRouter()
    const [series, setSeries] = useState<RecurringAppointmentWithRelations[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<{ id: string; action: SeriesConfirmation } | null>(null)

    useEffect(() => {
        let cancelled = false

        fetch(`/api/admin/recurring-appointments?userId=${userId}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to load standing appointments")
                return res.json() as Promise<{ data: RecurringAppointmentWithRelations[] }>
            })
            .then((body) => {
                if (!cancelled) setSeries(body.data)
            })
            .catch(() => {
                if (!cancelled) setSeries([])
            })

        return () => {
            cancelled = true
        }
    }, [userId])

    async function handleStatusChange(id: string, status: RecurringStatus): Promise<boolean> {
        setError(null)
        setNotice(null)
        setBusyId(id)

        try {
            const res = await fetch(`/api/admin/recurring-appointments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update that series. Please try again.")
                return false
            }

            const body = await res.json()
            // Use the server's returned row, don't assume the request
            // succeeded exactly as sent.
            setSeries((prev) =>
                prev
                    ? prev.map((s) => (s.id === id ? { ...s, ...body.data.recurringAppointment } : s))
                    : prev
            )
            setConfirming(null)
            if (body.data.materialization) {
                setNotice(describeResume(body.data.materialization))
            }
            // The appointment history on this same page is server-rendered;
            // pause/cancel/resume change which weeks are booked.
            router.refresh()
            return true
        } catch {
            setError("Network error. Please try again.")
            return false
        } finally {
            setBusyId(null)
        }
    }

    async function handleConfirm(s: RecurringAppointmentWithRelations) {
        const action = confirming?.action
        const ok = await handleStatusChange(s.id, "CANCELLED")
        if (ok && action === "change") router.push(adminRebookUrl(s))
    }

    if (series === null) {
        return <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
    }

    return (
        <div>
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="mb-3 text-sm text-foreground">
                    {notice}
                </p>
            )}

            {series.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No standing appointments.</p>
            ) : (
                <div className="mt-3 flex flex-col gap-2">
                    {series.map((s) => (
                        <RecurringSeriesRow
                            key={s.id}
                            series={s}
                            showCustomer={false}
                            busy={busyId === s.id}
                            confirming={confirming?.id === s.id ? confirming.action : null}
                            onPause={() => handleStatusChange(s.id, "PAUSED")}
                            onResume={() => handleStatusChange(s.id, "ACTIVE")}
                            onCancel={() => setConfirming({ id: s.id, action: "cancel" })}
                            onChangeTime={() => setConfirming({ id: s.id, action: "change" })}
                            onConfirm={() => handleConfirm(s)}
                            onConfirmBack={() => setConfirming(null)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
