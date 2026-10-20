'use client'

import { useState } from "react"
import type { Appointment, Artist } from "@/generated/prisma/client"
import { servicesLabel, servicesPriceCents, type ServiceLine } from "@/lib/appointment-services"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProfileForm, type ProfileFormValues } from "@/components/account/profile-form"
import { Price } from "@/components/ui/price"
import { discountOf } from "@/lib/discount"
import { formatDuration } from "@/lib/format"
import { durationMinutesOf } from "@/lib/schedule-grid"
import { STATUS_LABEL, STATUS_TONE } from "@/components/admin/appointment-shared"
import { AdminRecurringAppointments } from "./admin-recurring-appointments"
import { AdminCreditPanel } from "./admin-credit-panel"
import type { CreditEntryRow } from "@/lib/credit-shared"
import type { AdminUser } from "./admin-user-row"
import { CustomerSummaryPanel } from "./customer-summary-panel"
import { summarizeCustomer } from "@/lib/customer-summary"
import { useToast } from "@/components/ui/toast"

type UserAppointment = Appointment & { artist: Artist; services: ServiceLine[] }

export function AdminUserDetail({
    user,
    appointments,
    creditEntries,
}: {
    user: AdminUser
    appointments: UserAppointment[]
    creditEntries: CreditEntryRow[]
}) {
    const [current, setCurrent] = useState(user)
    const toast = useToast()
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    // "confirming" swaps the button for an in-page yes/no, the same pattern
    // as the other destructive actions (not window.confirm, which looks
    // like a browser warning and can't be styled or announced consistently).
    const [signOutStatus, setSignOutStatus] = useState<"idle" | "confirming" | "pending" | "done">("idle")

    // e.g. the customer lost their phone, or thinks someone got into their
    // account. Ends every session they have on its next request.
    async function handleSignOutEverywhere() {
        setError(null)
        setSignOutStatus("pending")
        try {
            const res = await fetch(`/api/admin/users/${current.id}/sign-out`, { method: "POST" })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't sign them out. Please try again.")
                setSignOutStatus("idle")
                return
            }
            setSignOutStatus("done")
            toast(`${current.name || current.email} is signed out on every device.`)
        } catch {
            setError("Network error. Please try again.")
            setSignOutStatus("idle")
        }
    }

    async function handleSave(values: ProfileFormValues) {
        setError(null)
        setSaving(true)

        try {
            const res = await fetch(`/api/admin/users/${current.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            const body = await res.json()
            setCurrent(body.data)
            setEditing(false)
            toast("Customer details saved.")
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mt-4">
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {editing ? (
                <ProfileForm
                    submitLabel={saving ? "Saving..." : "Save Changes"}
                    initial={{ name: current.name ?? "", email: current.email, phone: current.phone }}
                    onSubmit={handleSave}
                    onCancel={() => setEditing(false)}
                />
            ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-surface-foreground">{current.name || "(no name)"}</span>
                            <Badge tone={current.role === "ADMIN" ? "success" : "muted"}>{current.role}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{current.email}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{current.phone}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
                            Edit
                        </Button>
                        {signOutStatus === "confirming" ? (
                            <div role="group" aria-label="Confirm sign out everywhere" className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-foreground">
                                    {`Sign ${current.name || current.email} out on every device?`}
                                </span>
                                <Button variant="danger" size="md" onClick={handleSignOutEverywhere}>
                                    Yes, Sign Out
                                </Button>
                                <Button variant="secondary" size="md" onClick={() => setSignOutStatus("idle")}>
                                    Keep Signed In
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="md"
                                onClick={() => setSignOutStatus("confirming")}
                                disabled={signOutStatus !== "idle"}
                            >
                                {signOutStatus === "done" ? "Signed Out Everywhere" : signOutStatus === "pending" ? "Signing Out..." : "Sign Out Everywhere"}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <CustomerSummaryPanel summary={summarizeCustomer(appointments)} />

            <h3 className="mt-8 text-base font-semibold text-foreground">Store Credit</h3>
            <AdminCreditPanel
                userId={current.id}
                initialBalanceCents={user.creditBalanceCents}
                initialEntries={creditEntries}
            />

            <h3 className="mt-8 text-base font-semibold text-foreground">Standing Appointments</h3>
            <AdminRecurringAppointments userId={current.id} />

            <h3 className="mt-8 text-base font-semibold text-foreground">Appointment History</h3>

            {appointments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No appointments yet.</p>
            ) : (
                <div className="mt-3 flex flex-col gap-2">
                    {appointments.map((appointment) => (
                        <div
                            key={appointment.id}
                            className="flex flex-col gap-2 rounded-sm border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{servicesLabel(appointment.services)}</span>
                                    <Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">with {appointment.artist.name}</p>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                    {new Date(appointment.startTime).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>
                            <div className="text-sm text-muted-foreground sm:text-right">
                                {formatDuration(durationMinutesOf(appointment))} &middot;{" "}
                                <Price priceCents={servicesPriceCents(appointment.services)} discount={discountOf(appointment)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
