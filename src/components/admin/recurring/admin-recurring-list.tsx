'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { RecurringStatus } from "@/generated/prisma/client"
import {
    RecurringSeriesRow,
    describeResume,
    type RecurringAppointmentWithRelations,
    type SeriesConfirmation,
} from "@/components/recurring/recurring-series-row"
import { adminRebookUrl } from "@/components/recurring/admin-rebook-url"

// Seeded from a Server Component direct-read (same shape as
// admin/page.tsx -> ScheduleGrid) — the initial load needs no client fetch,
// but row-level mutations (Pause/Resume/Cancel) still need client-side state
// to update in place without a full reload.
export function AdminRecurringList({ initialSeries }: { initialSeries: RecurringAppointmentWithRelations[] }) {
    const router = useRouter()
    const [series, setSeries] = useState(initialSeries)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<{ id: string; action: SeriesConfirmation } | null>(null)

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
            setSeries((prev) =>
                prev.map((s) => (s.id === id ? { ...s, ...body.data.recurringAppointment } : s))
            )
            setConfirming(null)
            if (body.data.materialization) {
                setNotice(describeResume(body.data.materialization))
            }
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

    if (series.length === 0) {
        return <p className="mt-6 text-muted-foreground">No standing appointments.</p>
    }

    return (
        <div className="mt-6">
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

            <div className="flex flex-col gap-2">
                {series.map((s) => (
                    <div key={s.id} className="flex flex-col gap-1">
                        <RecurringSeriesRow
                            series={s}
                            showCustomer
                            busy={busyId === s.id}
                            confirming={confirming?.id === s.id ? confirming.action : null}
                            onPause={() => handleStatusChange(s.id, "PAUSED")}
                            onResume={() => handleStatusChange(s.id, "ACTIVE")}
                            onCancel={() => setConfirming({ id: s.id, action: "cancel" })}
                            onChangeTime={() => setConfirming({ id: s.id, action: "change" })}
                            onConfirm={() => handleConfirm(s)}
                            onConfirmBack={() => setConfirming(null)}
                        />
                        {s.user && (
                            <Link
                                href={`/admin/users/${s.user.id}`}
                                className="self-start pl-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                View customer &rarr;
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
