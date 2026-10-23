import Link from "next/link"
import { CalendarPlus, CheckCircle2, Download, MapPin, Phone } from "lucide-react"
import type { Artist, Service } from "@/generated/prisma/client"
import type { BookedAppointment, RecurringBookingResult } from "../wizard-state"
import { Button, buttonVariants } from "@/components/ui/button"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { DecoFrame } from "@/components/ui/deco"
import { googleCalendarUrl, icsFile, type CalendarEvent } from "@/lib/calendar"
import { describeNoticeWindow } from "@/lib/recurring"
import { SALON_CONTACT, SITE_NAME, formatPhone, mapUrl } from "@/lib/site"
import { formatSalonDate, formatSalonTime } from "@/lib/salon-time"

type ConfirmedStepProps = {
    // One or more, in the order they were chosen.
    services: Service[]
    artist: Artist
    // The salon's live cancellation window, for the policy line.
    cancellationNoticeHours: number
    // Same services and artist, a new time.
    onBookAgain: () => void
    // Start over.
    onBookAnother: () => void
} & (
    | { appointment: BookedAppointment; recurringResult?: undefined }
    | { appointment?: undefined; recurringResult: RecurringBookingResult }
)

// Where calendars say the visit is: the street address once it's set in
// SALON_CONTACT, otherwise the salon's name and town.
const LOCATION = SALON_CONTACT.address ?? `${SITE_NAME}, Amityville, NY`

// The happiest screen in the app (FEATURE_GAPS.md U7, Gap 20): what was
// booked, how to keep it, where to go and what the policy is — not a dead end.
export function ConfirmedStep(props: ConfirmedStepProps) {
    const { services, artist, cancellationNoticeHours, onBookAgain, onBookAnother } = props

    const visits = props.recurringResult ? props.recurringResult.created : [props.appointment]
    const first = visits[0]
    const firstStart = first ? new Date(first.startTime) : new Date(props.recurringResult!.recurringAppointment.seriesStart)
    const policy = `Need to change it? Reschedule or cancel online from My Bookings up to ${describeNoticeWindow(cancellationNoticeHours)} before.`
    const serviceNames = services.map((service) => service.name).join(" + ")

    const events: CalendarEvent[] = visits.map((visit) => ({
        uid: `${visit.id}@nail-image`,
        title: `${serviceNames} with ${artist.name}`,
        start: new Date(visit.startTime),
        end: new Date(visit.endTime),
        description: `${SITE_NAME}. ${policy}`,
        location: LOCATION,
    }))

    function downloadIcs() {
        const url = URL.createObjectURL(new Blob([icsFile(events)], { type: "text/calendar" }))
        const link = document.createElement("a")
        link.href = url
        link.download = events.length > 1 ? "nail-image-standing-appointment.ics" : "nail-image-appointment.ics"
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="draw-in h-14 w-14 text-success" aria-hidden />
            <p className="mt-3 font-script text-4xl text-lacquer">
                {props.recurringResult ? "You're all set!" : "You're booked!"}
            </p>
            <h2 className="sr-only">{props.recurringResult ? "Standing appointment created" : "Booking confirmed"}</h2>

            <div className="relative mt-6 flex w-full flex-col items-center rounded-xl border border-line bg-surface p-8 shadow-raised">
                <span className="text-primary">
                    <DecoFrame className="inset-2.5 rounded-lg" />
                </span>
                <CloudinaryImage
                    src={artist.photoUrl}
                    alt=""
                    sizes="80px"
                    className="h-20 w-20 rounded-full border-2 border-accent"
                />
                <p className="mt-3 font-serif text-3xl font-extrabold leading-tight text-foreground">
                    {formatSalonDate(firstStart, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <p className="mt-1 font-jost text-xl font-semibold text-primary-strong">
                    {formatSalonTime(firstStart)}
                </p>
                <p className="mt-3 text-body">
                    {`${serviceNames} with ${artist.name}`}
                </p>
                {first && (
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                        {`Booking ref ${first.id.slice(-6).toUpperCase()}`}
                    </p>
                )}
                {props.recurringResult && (
                    <div className="mt-4 w-full border-t border-border pt-4 text-left">
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
            </div>

            {events.length > 0 && (
                <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
                    {/* Google takes one event per link; the file holds every
                        visit of a standing appointment. */}
                    <a
                        href={googleCalendarUrl(events[0])}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "secondary", className: "flex-1" })}
                    >
                        <CalendarPlus className="h-4 w-4" aria-hidden />
                        {events.length > 1 ? "Google (1st visit)" : "Google Calendar"}
                    </a>
                    <Button type="button" variant="secondary" onClick={downloadIcs} className="flex-1">
                        <Download className="h-4 w-4" aria-hidden />
                        {events.length > 1 ? `Apple / Outlook (${events.length})` : "Apple / Outlook"}
                    </Button>
                </div>
            )}

            <div className="mt-6 flex w-full flex-col gap-2 text-left text-sm">
                {SALON_CONTACT.address && (
                    <a href={mapUrl(SALON_CONTACT.address)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                        {SALON_CONTACT.address}
                    </a>
                )}
                {SALON_CONTACT.phone && (
                    <a href={`tel:${SALON_CONTACT.phone}`} className="inline-flex min-h-11 items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" aria-hidden />
                        {formatPhone(SALON_CONTACT.phone)}
                    </a>
                )}
                <p className="text-muted-foreground">{policy}</p>
            </div>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
                <Link href="/appointments" className={buttonVariants({ className: "w-full sm:flex-1" })}>
                    View My Bookings
                </Link>
                <Button variant="secondary" onClick={onBookAgain} className="w-full sm:flex-1">
                    Book Again
                </Button>
            </div>
            <button
                type="button"
                onClick={onBookAnother}
                className="mt-3 min-h-11 cursor-pointer text-sm font-medium text-accent hover:text-primary-strong"
            >
                Book something else
            </button>
        </div>
    )
}
