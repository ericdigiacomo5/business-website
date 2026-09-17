import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import type { Appointment, Artist, Service } from "@/generated/prisma/client"
import type { RecurringBookingResult } from "../wizard-state"
import { Button, buttonVariants } from "@/components/ui/button"

type ConfirmedStepProps = {
    service: Service
    artist: Artist
    onBookAnother: () => void
} & (
    | { appointment: Appointment; recurringResult?: undefined }
    | { appointment?: undefined; recurringResult: RecurringBookingResult }
)

export function ConfirmedStep(props: ConfirmedStepProps) {
    const { service, artist, onBookAnother } = props

    const headline = props.recurringResult ? "Standing Appointment Created" : "Booking Confirmed"
    const firstStart = props.recurringResult
        ? props.recurringResult.created[0]?.startTime ?? props.recurringResult.recurringAppointment.seriesStart
        : props.appointment.startTime

    return (
        <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold text-foreground">{headline}</h2>
            <p className="mt-2 text-muted-foreground">
                {service.name} with {artist.name}
                <br />
                {new Date(firstStart).toLocaleString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                })}
            </p>

            {props.recurringResult && (
                <div className="mt-4 w-full rounded-sm border border-border bg-surface p-4 text-left">
                    <p className="text-sm font-medium text-surface-foreground">
                        {props.recurringResult.created.length} appointment
                        {props.recurringResult.created.length === 1 ? "" : "s"} booked
                        {props.recurringResult.skipped.length > 0
                            ? `, ${props.recurringResult.skipped.length} skipped`
                            : ""}
                    </p>
                    {props.recurringResult.skipped.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                            {props.recurringResult.skipped.map((s) => (
                                <li key={s.date}>
                                    {s.date}: {s.reason}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href="/appointments" className={buttonVariants({ className: "w-full sm:w-auto" })}>
                    View My Bookings
                </Link>
                <Button variant="secondary" onClick={onBookAnother} className="w-full sm:w-auto">
                    Book Another
                </Button>
            </div>
        </div>
    )
}
