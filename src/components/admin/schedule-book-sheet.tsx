import { useState } from "react"
import { X } from "lucide-react"
import type { Artist, Service } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { UserStep } from "@/components/booking/steps/user-step"
import { ServiceStep } from "@/components/booking/steps/service-step"
import { ReviewStep } from "@/components/booking/steps/review-step"
import type { BookedAppointment, RecurringBookingResult, SelectedUser } from "@/components/booking/wizard-state"
import type { AdminAppointment } from "./appointment-shared"

// Booking from the schedule grid: the clicked cell already fixes the artist,
// date and time, so only the customer and the services are left to choose.
// Same centered-modal shell as ScheduleDetailSheet, and the same step
// components the customer wizard uses — the review step still owns the POST
// (one-off or standing), so there's one booking code path, not two.
export function ScheduleBookSheet({
    artist,
    startTime,
    services,
    onBooked,
    onClose,
}: {
    artist: Artist
    startTime: Date
    services: Service[]
    // `appointments` are the new rows in the grid's own shape (relations
    // attached); `notice` is set when there's more to say than the new block
    // shows on its own (a standing appointment's other weeks).
    onBooked: (appointments: AdminAppointment[], notice: string | null) => void
    onClose: () => void
}) {
    const [user, setUser] = useState<SelectedUser | null>(null)
    // One or more, in the order they were picked; `servicesChosen` flips
    // once the admin presses Continue (picking doesn't advance on its own).
    const [serviceIds, setServiceIds] = useState<string[]>([])
    const [servicesChosen, setServicesChosen] = useState(false)

    const chosenServices = serviceIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is Service => s !== undefined)

    function toggleService(id: string) {
        setServiceIds((prev) => (prev.includes(id) ? prev.filter((other) => other !== id) : [...prev, id]))
    }

    const when = startTime.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })

    // The booking routes return each appointment with its service lines; the
    // grid also renders the artist and customer off each block, and both are
    // already in hand here.
    function withRelations(appointment: BookedAppointment): AdminAppointment {
        return { ...appointment, artist, user: user! }
    }

    function handleRecurringSuccess(result: RecurringBookingResult) {
        const visits = result.created.length
        const skipped = result.skipped.length
        const notice =
            `Standing appointment booked — ${visits} visit${visits === 1 ? "" : "s"}` +
            (skipped > 0
                ? `, ${skipped} date${skipped === 1 ? "" : "s"} couldn't be booked (listed under Standing Appointments).`
                : ".")
        // The grid drops any that aren't on the day it's showing.
        onBooked(result.created.map(withRelations), notice)
    }

    return (
        <div
            className="fixed inset-0 z-30 flex cursor-pointer items-center justify-center bg-foreground/40 p-4"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="New booking"
                onClick={(e) => e.stopPropagation()}
                className={
                    "max-h-[92vh] w-full max-w-md cursor-auto overflow-y-auto rounded-2xl border " +
                    "border-border bg-background px-4 pt-4 pb-6 shadow-lg"
                }
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-medium text-foreground">New Booking</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {artist.name} &middot; {when}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-4">
                    {!user ? (
                        <UserStep onSelect={setUser} />
                    ) : !servicesChosen ? (
                        <div className="flex flex-col gap-4">
                            <ServiceStep
                                services={services}
                                selectedIds={serviceIds}
                                subtitle={null}
                                onToggle={toggleService}
                            />
                            <div className="flex gap-2">
                                <Button variant="ghost" size="md" onClick={() => setUser(null)}>
                                    Back
                                </Button>
                                <Button
                                    size="md"
                                    onClick={() => setServicesChosen(true)}
                                    disabled={chosenServices.length === 0}
                                    className="flex-1"
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <ReviewStep
                            inline
                            services={chosenServices}
                            artist={artist}
                            startTime={startTime.toISOString()}
                            userLabel={user.name ?? user.email}
                            adminMode
                            targetUserId={user.id}
                            // There's no time picker to fall back to here —
                            // the time came from the cell that was clicked.
                            slotUnavailableMessage="That time isn't open for the full length of these services. Close this and pick another time on the schedule."
                            onBack={() => setServicesChosen(false)}
                            onSuccess={(appointment) => onBooked([withRelations(appointment)], null)}
                            onRecurringSuccess={handleRecurringSuccess}
                            onSlotUnavailable={() => {}}
                            // Can't happen: this sheet only renders inside the
                            // admin layout's role gate.
                            onUnauthenticated={onClose}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
