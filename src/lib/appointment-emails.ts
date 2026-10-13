import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import {
    appointmentCancelledEmail,
    appointmentReminderEmail,
    appointmentRescheduledEmail,
    bookingConfirmationEmail,
    receiptEmail,
    recurringConfirmationEmail,
    recurringCancelledEmail,
    type AppointmentEmailDetails,
} from "@/lib/email-templates"
import { PAYMENT_METHOD_LABEL } from "@/components/admin/appointment-shared"
import { discountOf } from "@/lib/discount"
import { durationMinutesOf } from "@/lib/schedule-grid"
import { SERVICE_LINES_INCLUDE, servicesLabel, servicesPriceCents } from "@/lib/appointment-services"

// Server-only (imports prisma) — never import this from a Client Component or
// from any module one imports; see PROJECT_STATUS.md's RSC-boundary notes.
//
// Every function here is meant to be scheduled with after() from a route
// handler, never awaited inline: the booking/cancel/reschedule has already
// committed by the time it runs, and its response shouldn't wait on (or fail
// because of) an email. sendEmail() already never throws; these wrap their
// own DB lookups too, so nothing here can surface as an unhandled error.

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000

const CUSTOMER_SELECT = {
    name: true,
    email: true,
    passwordHash: true,
    accounts: { select: { provider: true }, take: 1 },
} as const

const APPOINTMENT_INCLUDE = {
    user: { select: CUSTOMER_SELECT },
    artist: { select: { name: true } },
    ...SERVICE_LINES_INCLUDE,
} as const

type CustomerRow = {
    name: string | null
    passwordHash: string | null
    accounts: { provider: string }[]
}

// A walk-in created by an admin has neither a password nor a linked OAuth
// account, so it can never sign in — links into the signed-in parts of the
// site are dropped for them rather than sent as dead ends.
function customerLinks(user: CustomerRow): { manageUrl: string | null; bookUrl: string | null } {
    const canSignIn = user.passwordHash !== null || user.accounts.length > 0
    if (!canSignIn) return { manageUrl: null, bookUrl: null }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return { manageUrl: `${appUrl}/appointments`, bookUrl: `${appUrl}/book` }
}

async function loadAppointment(appointmentId: string) {
    return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: APPOINTMENT_INCLUDE,
    })
}

type LoadedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>

function toDetails(appointment: LoadedAppointment): AppointmentEmailDetails {
    return {
        customerName: appointment.user.name,
        // "Manicure + Pedicure" when there's more than one.
        serviceName: servicesLabel(appointment.services),
        artistName: appointment.artist.name,
        startTime: appointment.startTime,
        // The appointment's own length — an admin may have set it to
        // something other than the services' usual duration.
        durationMinutes: durationMinutesOf(appointment),
        // What the services were booked at, not their current prices.
        priceCents: servicesPriceCents(appointment.services),
        discount: discountOf(appointment),
        ...customerLinks(appointment.user),
    }
}

function isInPast(date: Date): boolean {
    return date.getTime() < Date.now()
}

function isWithinReminderWindow(date: Date): boolean {
    return date.getTime() - Date.now() <= REMINDER_WINDOW_MS
}

// A booking or reschedule landing inside the 24h window means the email just
// sent already *is* the reminder — stamping reminderSentAt keeps the job from
// sending a second, near-identical email minutes later. Conditional on
// reminderSentAt still being null, same claim semantics as the job itself.
async function markReminderCoveredIfImminent(appointmentId: string, startTime: Date) {
    if (!isWithinReminderWindow(startTime)) return
    await prisma.appointment.updateMany({
        where: { id: appointmentId, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
    })
}

async function safely(label: string, fn: () => Promise<void>) {
    try {
        await fn()
    } catch (error) {
        console.error(`[email] ${label} failed:`, error)
    }
}

export function sendBookingConfirmation(appointmentId: string) {
    return safely("booking confirmation", async () => {
        const appointment = await loadAppointment(appointmentId)
        // An admin entering a walk-in after the fact (FEATURE_GAPS.md Gap 3)
        // books a time that's already over — "you're booked for an hour
        // ago" would only confuse the customer.
        if (!appointment || isInPast(appointment.startTime)) return

        const { ok } = await sendEmail({ to: appointment.user.email, ...bookingConfirmationEmail(toDetails(appointment)) })
        if (ok) await markReminderCoveredIfImminent(appointment.id, appointment.startTime)
    })
}

export function sendRescheduleNotice(appointmentId: string, previousStartTime: Date) {
    return safely("reschedule notice", async () => {
        const appointment = await loadAppointment(appointmentId)
        if (!appointment || isInPast(appointment.startTime)) return

        const { ok } = await sendEmail({
            to: appointment.user.email,
            ...appointmentRescheduledEmail({ ...toDetails(appointment), previousStartTime }),
        })
        if (ok) await markReminderCoveredIfImminent(appointment.id, appointment.startTime)
    })
}

export function sendCancellationNotice(appointmentId: string, cancelledBy: "customer" | "salon") {
    return safely("cancellation notice", async () => {
        const appointment = await loadAppointment(appointmentId)
        // Cancelling something that already happened is admin record-keeping
        // (fixing a mistake), not news the customer needs.
        if (!appointment || isInPast(appointment.startTime)) return

        await sendEmail({
            to: appointment.user.email,
            ...appointmentCancelledEmail({ ...toDetails(appointment), cancelledBy }),
        })
    })
}

export function sendReceipt(appointmentId: string) {
    return safely("receipt", async () => {
        const appointment = await loadAppointment(appointmentId)
        if (!appointment || !appointment.paymentMethod || !appointment.checkedOutAt) return

        await sendEmail({
            to: appointment.user.email,
            ...receiptEmail({
                ...toDetails(appointment),
                paymentMethodLabel: PAYMENT_METHOD_LABEL[appointment.paymentMethod],
                checkedOutAt: appointment.checkedOutAt,
            }),
        })
    })
}

// One summary email per standing-appointment signup, not one per materialized
// occurrence — the recurring route books the whole series in a loop, and
// dozens of near-identical confirmations in a row would read as spam.
export function sendRecurringConfirmation(
    recurringAppointmentId: string,
    createdAppointmentIds: string[],
    skippedStartTimes: Date[],
) {
    return safely("recurring confirmation", async () => {
        const [series, occurrences] = await Promise.all([
            loadSeries(recurringAppointmentId),
            prisma.appointment.findMany({
                where: { id: { in: createdAppointmentIds } },
                select: { id: true, startTime: true },
                orderBy: { startTime: "asc" },
            }),
        ])
        if (!series) return

        // Same reasoning as the one-off confirmation: an admin backdating a
        // series shouldn't email the customer a list of dates that are
        // already over.
        const upcoming = occurrences.filter((o) => !isInPast(o.startTime))
        if (upcoming.length === 0) return

        const { ok } = await sendEmail({
            to: series.user.email,
            ...recurringConfirmationEmail({
                ...seriesDetails(series),
                occurrences: upcoming.map((o) => o.startTime),
                skippedDates: skippedStartTimes.filter((d) => !isInPast(d)),
            }),
        })
        if (ok) {
            for (const o of upcoming) await markReminderCoveredIfImminent(o.id, o.startTime)
        }
    })
}

export function sendRecurringCancelledNotice(
    recurringAppointmentId: string,
    changedBy: "customer" | "salon",
    cancelledAppointmentIds: string[],
) {
    return safely("recurring cancelled notice", async () => {
        const [series, cancelled] = await Promise.all([
            loadSeries(recurringAppointmentId),
            prisma.appointment.findMany({
                where: { id: { in: cancelledAppointmentIds } },
                select: { startTime: true },
                orderBy: { startTime: "asc" },
            }),
        ])
        if (!series) return

        await sendEmail({
            to: series.user.email,
            ...recurringCancelledEmail({
                ...seriesDetails(series),
                changedBy,
                cancelledOccurrences: cancelled.map((a) => a.startTime),
            }),
        })
    })
}

async function loadSeries(recurringAppointmentId: string) {
    return prisma.recurringAppointment.findUnique({
        where: { id: recurringAppointmentId },
        include: {
            user: { select: CUSTOMER_SELECT },
            artist: { select: { name: true } },
            ...SERVICE_LINES_INCLUDE,
        },
    })
}

function seriesDetails(series: NonNullable<Awaited<ReturnType<typeof loadSeries>>>) {
    return {
        customerName: series.user.name,
        serviceName: servicesLabel(series.services),
        artistName: series.artist.name,
        intervalWeeks: series.intervalWeeks,
        manageUrl: customerLinks(series.user).manageUrl,
    }
}

export type ReminderRunResult = { considered: number; sent: number; failed: number }

// Called by the guarded job route on a schedule (see
// src/app/api/jobs/send-reminders/route.ts). Safe to run as often as you
// like, and safe to run concurrently: each row is *claimed* by flipping
// reminderSentAt from null to now in a conditional updateMany, so two
// overlapping runs can never both send for the same appointment — the
// loser's update matches zero rows and it moves on. Same "let the database
// arbitrate the race" instinct as AppointmentSlot's unique constraint.
export async function sendDueReminders(): Promise<ReminderRunResult> {
    const now = new Date()
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS)

    // Status re-checked here, at send time, not when the booking was made —
    // cancellation is a soft status update, so a cancelled appointment's row
    // still exists and would otherwise still match on time alone.
    const due = await prisma.appointment.findMany({
        where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            reminderSentAt: null,
            startTime: { gt: now, lte: windowEnd },
        },
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: "asc" },
    })

    let sent = 0
    let failed = 0

    for (const appointment of due) {
        const claimed = await prisma.appointment.updateMany({
            where: { id: appointment.id, reminderSentAt: null },
            data: { reminderSentAt: now },
        })
        if (claimed.count === 0) continue

        const { ok } = await sendEmail({
            to: appointment.user.email,
            ...appointmentReminderEmail(toDetails(appointment)),
        })

        if (ok) {
            sent++
        } else {
            // Release the claim so the next run retries — a provider outage
            // shouldn't permanently cost this customer their reminder.
            failed++
            await prisma.appointment.updateMany({
                where: { id: appointment.id, reminderSentAt: now },
                data: { reminderSentAt: null },
            })
        }
    }

    return { considered: due.length, sent, failed }
}
