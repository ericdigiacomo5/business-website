import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import { errorMessage, reportError } from "@/lib/report-error"
import {
    appointmentCancelledEmail,
    appointmentReminderEmail,
    appointmentRescheduledEmail,
    bookingConfirmationEmail,
    creditAddedEmail,
    receiptEmail,
    recurringConfirmationEmail,
    recurringCancelledEmail,
    type AppointmentEmailDetails,
} from "@/lib/email-templates"
import { PAYMENT_METHOD_LABEL } from "@/components/admin/appointment-shared"
import { discountOf } from "@/lib/discount"
import { durationMinutesOf } from "@/lib/schedule-grid"
import { SERVICE_LINES_INCLUDE, servicesLabel, servicesPriceCents } from "@/lib/appointment-services"
import { getPolicySettings } from "@/lib/settings"
import {
    textBookingConfirmation,
    textCancellationNotice,
    textRecurringCancelledNotice,
    textRecurringConfirmation,
    textRescheduleNotice,
} from "@/lib/appointment-sms"

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
    emailVerified: true,
    passwordHash: true,
} as const

const APPOINTMENT_INCLUDE = {
    user: { select: CUSTOMER_SELECT },
    artist: { select: { name: true } },
    ...SERVICE_LINES_INCLUDE,
} as const

type CustomerRow = {
    name: string | null
    emailVerified: Date | null
    passwordHash: string | null
}

// Email and password is the only way to sign in, so an account without a
// password is a walk-in created by staff.
function canSignIn(user: CustomerRow): boolean {
    return user.passwordHash !== null
}

// Whether this customer's address may get the salon's emails. A
// self-registered account's address is whatever the person typed, so until
// its owner clicks the verification link, nothing is sent to it — otherwise
// signing up with a stranger's address (and a "name" containing a message)
// would deliver that message from the salon's own domain. Walk-ins (no
// password) were entered by staff, who vouch for them.
// Checked here, centrally, so no single route can forget it.
function mayEmail(user: CustomerRow): boolean {
    return user.emailVerified !== null || !canSignIn(user)
}

// A walk-in created by an admin has no password, so it can never sign in —
// links into the signed-in parts of the site are dropped for them rather
// than sent as dead ends.
function customerLinks(user: CustomerRow): { manageUrl: string | null; bookUrl: string | null } {
    if (!canSignIn(user)) return { manageUrl: null, bookUrl: null }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return { manageUrl: `${appUrl}/appointments`, bookUrl: `${appUrl}/book` }
}

async function loadAppointment(appointmentId: string) {
    return prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: APPOINTMENT_INCLUDE,
    })
}

async function noticeHours(): Promise<number> {
    return (await getPolicySettings()).cancellationNoticeHours
}

type LoadedAppointment = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>

// cancellationNoticeHours: the salon's current setting, so the footer states
// the real online change window. Pass getPolicySettings()'s value.
function toDetails(appointment: LoadedAppointment, cancellationNoticeHours: number): AppointmentEmailDetails {
    return {
        cancellationNoticeHours,
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
        await reportError({ event: "email_failed", message: `${label}: ${errorMessage(error)}` })
    }
}

// Booking events also send their text (appointment-sms.ts) from here, so
// every route that emails the customer about an appointment texts them too,
// without each route having to remember. Receipts and credit notices are
// email only.
function alongside(email: Promise<void>, text: Promise<void>): Promise<void> {
    return Promise.all([email, text]).then(() => undefined)
}

export function sendBookingConfirmation(appointmentId: string) {
    return alongside(sendBookingConfirmationEmail(appointmentId), textBookingConfirmation(appointmentId))
}

function sendBookingConfirmationEmail(appointmentId: string) {
    return safely("booking confirmation", async () => {
        const appointment = await loadAppointment(appointmentId)
        // An admin entering a walk-in after the fact (FEATURE_GAPS.md Gap 3)
        // books a time that's already over — "you're booked for an hour
        // ago" would only confuse the customer.
        if (!appointment || isInPast(appointment.startTime) || !mayEmail(appointment.user)) return

        const { ok } = await sendEmail({ to: appointment.user.email, ...bookingConfirmationEmail(toDetails(appointment, await noticeHours())) })
        if (ok) await markReminderCoveredIfImminent(appointment.id, appointment.startTime)
    })
}

export function sendRescheduleNotice(appointmentId: string, previousStartTime: Date) {
    return alongside(sendRescheduleEmail(appointmentId, previousStartTime), textRescheduleNotice(appointmentId))
}

function sendRescheduleEmail(appointmentId: string, previousStartTime: Date) {
    return safely("reschedule notice", async () => {
        const appointment = await loadAppointment(appointmentId)
        if (!appointment || isInPast(appointment.startTime) || !mayEmail(appointment.user)) return

        const { ok } = await sendEmail({
            to: appointment.user.email,
            ...appointmentRescheduledEmail({ ...toDetails(appointment, await noticeHours()), previousStartTime }),
        })
        if (ok) await markReminderCoveredIfImminent(appointment.id, appointment.startTime)
    })
}

export function sendCancellationNotice(appointmentId: string, cancelledBy: "customer" | "salon") {
    return alongside(sendCancellationEmail(appointmentId, cancelledBy), textCancellationNotice(appointmentId, cancelledBy))
}

function sendCancellationEmail(appointmentId: string, cancelledBy: "customer" | "salon") {
    return safely("cancellation notice", async () => {
        const appointment = await loadAppointment(appointmentId)
        // Cancelling something that already happened is admin record-keeping
        // (fixing a mistake), not news the customer needs.
        if (!appointment || isInPast(appointment.startTime) || !mayEmail(appointment.user)) return

        await sendEmail({
            to: appointment.user.email,
            ...appointmentCancelledEmail({ ...toDetails(appointment, await noticeHours()), cancelledBy }),
        })
    })
}

export function sendReceipt(appointmentId: string) {
    return safely("receipt", async () => {
        const appointment = await loadAppointment(appointmentId)
        // No payment method is normal when store credit covered everything.
        if (!appointment || !appointment.checkedOutAt || !mayEmail(appointment.user)) return

        await sendEmail({
            to: appointment.user.email,
            ...receiptEmail({
                ...toDetails(appointment, await noticeHours()),
                paymentMethodLabel: appointment.paymentMethod ? PAYMENT_METHOD_LABEL[appointment.paymentMethod] : null,
                creditAppliedCents: appointment.creditAppliedCents,
                checkedOutAt: appointment.checkedOutAt,
            }),
        })
    })
}

// After a gift card is redeemed onto an account. Not appointment-specific,
// but lives here for the shared customer lookup and links.
export function sendCreditAdded(userId: string, addedCents: number) {
    return safely("credit added", async () => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { ...CUSTOMER_SELECT, creditBalanceCents: true },
        })
        if (!user || !mayEmail(user)) return

        const { manageUrl } = customerLinks(user)
        await sendEmail({
            to: user.email,
            ...creditAddedEmail({
                customerName: user.name,
                addedCents,
                balanceCents: user.creditBalanceCents,
                accountUrl: manageUrl ? `${process.env.NEXT_PUBLIC_APP_URL}/account` : null,
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
    return alongside(
        sendRecurringConfirmationEmail(recurringAppointmentId, createdAppointmentIds, skippedStartTimes),
        textRecurringConfirmation(recurringAppointmentId, createdAppointmentIds),
    )
}

function sendRecurringConfirmationEmail(
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
        if (!series || !mayEmail(series.user)) return

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
    return alongside(
        sendRecurringCancelledEmail(recurringAppointmentId, changedBy, cancelledAppointmentIds),
        textRecurringCancelledNotice(recurringAppointmentId, cancelledAppointmentIds),
    )
}

function sendRecurringCancelledEmail(
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
        if (!series || !mayEmail(series.user)) return

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
    const cancellationNoticeHours = await noticeHours()

    for (const appointment of due) {
        // Not claimed, so the reminder still goes out if the address is
        // confirmed before the appointment.
        if (!mayEmail(appointment.user)) continue

        const claimed = await prisma.appointment.updateMany({
            where: { id: appointment.id, reminderSentAt: null },
            data: { reminderSentAt: now },
        })
        if (claimed.count === 0) continue

        const { ok } = await sendEmail({
            to: appointment.user.email,
            ...appointmentReminderEmail(toDetails(appointment, cancellationNoticeHours)),
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
