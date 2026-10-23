// Appointment texts — the SMS twin of appointment-emails.ts, which calls
// these from each of its send functions, so every booking event that emails
// the customer also texts them (when they've opted in). Server-only.
//
// Like the emails: scheduled with after(), never awaited inline; never
// throws (failures are reported, not raised); nothing about a past
// appointment. Every attempt is logged as an SmsMessage row.

import { prisma } from "@/lib/prisma"
import { isSmsConfigured, sendSms } from "@/lib/sms"
import { optOutPhone } from "@/lib/sms-consent-data"
import { errorMessage, reportError } from "@/lib/report-error"
import {
    bookingConfirmationSms,
    cancellationSms,
    isWithinTextingHours,
    optInRequestSms,
    recurringCancelledSms,
    recurringConfirmationSms,
    reminderSms,
    rescheduleSms,
} from "@/lib/sms-templates"
import type { SmsKind } from "@/generated/prisma/client"

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000
// "Reply YES" can be re-sent by ticking the box again, but not more than
// once a minute (the same cooldown as the email links).
const OPT_IN_REQUEST_COOLDOWN_MS = 60 * 1000

const SMS_USER_SELECT = {
    id: true,
    smsOptIn: true,
    smsPhone: true,
    smsConfirmedAt: true,
    passwordHash: true,
} as const

type SmsUser = { id: string; smsOptIn: boolean; smsPhone: string | null; smsConfirmedAt: Date | null; passwordHash: string | null }

// Opted in and confirmed by a YES reply from that number. Returns the number.
function textablePhone(user: SmsUser): string | null {
    return user.smsOptIn && user.smsConfirmedAt !== null ? user.smsPhone : null
}

// A walk-in (no password) can't sign in, so no link — the same rule as the
// emails. Walk-ins can't opt in either, so this is belt and braces.
function manageUrl(user: SmsUser): string | null {
    return user.passwordHash === null ? null : `${process.env.NEXT_PUBLIC_APP_URL}/appointments`
}

const isInPast = (date: Date) => date.getTime() < Date.now()

async function safely(label: string, fn: () => Promise<void>) {
    try {
        await fn()
    } catch (error) {
        await reportError({ event: "sms_failed", message: `${label}: ${errorMessage(error)}` })
    }
}

// Sends one text and logs it. Returns whether it went (dev counts as sent).
async function deliver(args: { userId: string; appointmentId?: string; kind: SmsKind; to: string; body: string }): Promise<boolean> {
    const result = await sendSms(args.to, args.body)
    // Texting not set up yet (production, before the campaign is approved):
    // nothing was attempted, so there's nothing to log.
    if (!result.ok && result.notConfigured) return false

    await prisma.smsMessage.create({
        data: {
            userId: args.userId,
            appointmentId: args.appointmentId ?? null,
            kind: args.kind,
            to: args.to,
            body: args.body,
            providerSid: result.ok ? result.sid : null,
            status: result.ok ? result.status : "not_sent",
            errorCode: result.ok ? null : result.errorCode,
        },
    })

    // The number replied STOP at some point Twilio knows about and the app
    // missed: record the opt-out so nothing else is tried.
    if (!result.ok && result.optedOut) await optOutPhone(args.to, "carrier")
    return result.ok
}

async function loadAppointment(appointmentId: string) {
    return prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            id: true,
            startTime: true,
            status: true,
            user: { select: SMS_USER_SELECT },
            artist: { select: { name: true } },
        },
    })
}

// A text sent inside the 24h window already tells the customer the time, so
// the reminder text is marked as done (the email side does the same).
async function markSmsReminderCoveredIfImminent(appointmentId: string, startTime: Date) {
    if (startTime.getTime() - Date.now() > REMINDER_WINDOW_MS) return
    await prisma.appointment.updateMany({
        where: { id: appointmentId, smsReminderSentAt: null },
        data: { smsReminderSentAt: new Date() },
    })
}

export function textBookingConfirmation(appointmentId: string) {
    return safely("booking confirmation text", async () => {
        const appointment = await loadAppointment(appointmentId)
        const to = appointment && textablePhone(appointment.user)
        if (!appointment || !to || isInPast(appointment.startTime)) return

        const body = bookingConfirmationSms({
            artistName: appointment.artist.name,
            startTime: appointment.startTime,
            manageUrl: manageUrl(appointment.user),
        })
        const sent = await deliver({ userId: appointment.user.id, appointmentId, kind: "BOOKING_CONFIRMATION", to, body })
        if (sent) await markSmsReminderCoveredIfImminent(appointmentId, appointment.startTime)
    })
}

export function textRescheduleNotice(appointmentId: string) {
    return safely("reschedule text", async () => {
        const appointment = await loadAppointment(appointmentId)
        const to = appointment && textablePhone(appointment.user)
        if (!appointment || !to || isInPast(appointment.startTime)) return

        const body = rescheduleSms({
            artistName: appointment.artist.name,
            startTime: appointment.startTime,
            manageUrl: manageUrl(appointment.user),
        })
        const sent = await deliver({ userId: appointment.user.id, appointmentId, kind: "RESCHEDULE", to, body })
        if (sent) await markSmsReminderCoveredIfImminent(appointmentId, appointment.startTime)
    })
}

export function textCancellationNotice(appointmentId: string, cancelledBy: "customer" | "salon") {
    return safely("cancellation text", async () => {
        const appointment = await loadAppointment(appointmentId)
        const to = appointment && textablePhone(appointment.user)
        if (!appointment || !to || isInPast(appointment.startTime)) return

        const body = cancellationSms({ artistName: appointment.artist.name, startTime: appointment.startTime, cancelledBy })
        await deliver({ userId: appointment.user.id, appointmentId, kind: "CANCELLATION", to, body })
    })
}

async function loadSeries(recurringAppointmentId: string) {
    return prisma.recurringAppointment.findUnique({
        where: { id: recurringAppointmentId },
        select: { intervalWeeks: true, user: { select: SMS_USER_SELECT }, artist: { select: { name: true } } },
    })
}

// One text for a whole new standing appointment, like the one summary email.
export function textRecurringConfirmation(recurringAppointmentId: string, createdAppointmentIds: string[]) {
    return safely("recurring confirmation text", async () => {
        const [series, occurrences] = await Promise.all([
            loadSeries(recurringAppointmentId),
            prisma.appointment.findMany({
                where: { id: { in: createdAppointmentIds } },
                select: { id: true, startTime: true },
                orderBy: { startTime: "asc" },
            }),
        ])
        const to = series && textablePhone(series.user)
        const upcoming = occurrences.filter((o) => !isInPast(o.startTime))
        if (!series || !to || upcoming.length === 0) return

        const body = recurringConfirmationSms({
            artistName: series.artist.name,
            firstStart: upcoming[0].startTime,
            visits: upcoming.length,
            intervalWeeks: series.intervalWeeks,
        })
        const sent = await deliver({ userId: series.user.id, kind: "RECURRING_CONFIRMATION", to, body })
        if (sent) {
            for (const o of upcoming) await markSmsReminderCoveredIfImminent(o.id, o.startTime)
        }
    })
}

export function textRecurringCancelledNotice(recurringAppointmentId: string, cancelledAppointmentIds: string[]) {
    return safely("recurring cancelled text", async () => {
        const [series, cancelled] = await Promise.all([
            loadSeries(recurringAppointmentId),
            prisma.appointment.findMany({
                where: { id: { in: cancelledAppointmentIds } },
                select: { startTime: true },
            }),
        ])
        const to = series && textablePhone(series.user)
        const upcoming = cancelled.filter((a) => !isInPast(a.startTime)).length
        if (!series || !to || upcoming === 0) return

        await deliver({
            userId: series.user.id,
            kind: "RECURRING_CANCELLATION",
            to,
            body: recurringCancelledSms({ artistName: series.artist.name, visits: upcoming }),
        })
    })
}

// The double opt-in request ("Reply YES"). Claimed by stamping
// smsConfirmRequestedAt first (conditional, so two calls can't both send);
// the stamp is released if the send doesn't go, so the job retries it.
export function sendOptInRequest(userId: string) {
    return safely("opt-in request text", async () => {
        const now = new Date()
        const claimed = await prisma.user.updateMany({
            where: {
                id: userId,
                smsOptIn: true,
                smsConfirmedAt: null,
                smsPhone: { not: null },
                OR: [
                    { smsConfirmRequestedAt: null },
                    { smsConfirmRequestedAt: { lt: new Date(now.getTime() - OPT_IN_REQUEST_COOLDOWN_MS) } },
                ],
            },
            data: { smsConfirmRequestedAt: now },
        })
        if (claimed.count === 0) return

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { smsPhone: true } })
        if (!user?.smsPhone) return

        const sent = await deliver({ userId, kind: "OPT_IN_REQUEST", to: user.smsPhone, body: optInRequestSms() })
        if (!sent) {
            await prisma.user.updateMany({ where: { id: userId, smsConfirmRequestedAt: now }, data: { smsConfirmRequestedAt: null } })
        }
    })
}

export type SmsJobResult = {
    reminders: { considered: number; sent: number; failed: number }
    optInRequests: number
    // Why nothing was sent this run, if so.
    skipped: "quiet_hours" | "not_configured" | null
}

// Run by the reminder job (POST /api/jobs/send-reminders) each hour:
// 24h reminder texts, plus any "Reply YES" texts still owed (opt-ins made
// before texting was configured, or whose send failed). Outside texting
// hours it sends nothing; the next run in hours picks everything up.
export async function runSmsJob(now: Date = new Date()): Promise<SmsJobResult> {
    const nothing = { reminders: { considered: 0, sent: 0, failed: 0 }, optInRequests: 0 }
    if (!isSmsConfigured() && process.env.NODE_ENV === "production") return { ...nothing, skipped: "not_configured" }
    if (!isWithinTextingHours(now)) return { ...nothing, skipped: "quiet_hours" }

    const owed = await prisma.user.findMany({
        where: { smsOptIn: true, smsConfirmedAt: null, smsConfirmRequestedAt: null, smsPhone: { not: null } },
        select: { id: true },
        take: 100,
    })
    for (const { id } of owed) await sendOptInRequest(id)

    return { reminders: await sendDueSmsReminders(now), optInRequests: owed.length, skipped: null }
}

// Same claim-then-send pattern as sendDueReminders() in appointment-emails.ts,
// on its own column, so a concurrent run can't send a reminder twice.
async function sendDueSmsReminders(now: Date) {
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS)
    const due = await prisma.appointment.findMany({
        where: {
            status: { in: ["PENDING", "CONFIRMED"] },
            smsReminderSentAt: null,
            startTime: { gt: now, lte: windowEnd },
            user: { smsOptIn: true, smsConfirmedAt: { not: null } },
        },
        select: { id: true, startTime: true, user: { select: SMS_USER_SELECT }, artist: { select: { name: true } } },
        orderBy: { startTime: "asc" },
    })

    let sent = 0
    let failed = 0
    for (const appointment of due) {
        const to = textablePhone(appointment.user)
        if (!to) continue

        const claimed = await prisma.appointment.updateMany({
            where: { id: appointment.id, smsReminderSentAt: null },
            data: { smsReminderSentAt: now },
        })
        if (claimed.count === 0) continue

        const body = reminderSms({
            artistName: appointment.artist.name,
            startTime: appointment.startTime,
            manageUrl: manageUrl(appointment.user),
        })
        if (await deliver({ userId: appointment.user.id, appointmentId: appointment.id, kind: "REMINDER", to, body })) {
            sent++
        } else {
            failed++
            await prisma.appointment.updateMany({
                where: { id: appointment.id, smsReminderSentAt: now },
                data: { smsReminderSentAt: null },
            })
        }
    }
    return { considered: due.length, sent, failed }
}
