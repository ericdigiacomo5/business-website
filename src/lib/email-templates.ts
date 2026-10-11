import { SITE_NAME } from "@/lib/site"
import { formatDuration, formatPrice } from "@/lib/format"

type RenderedEmail = {
    subject: string
    html: string
    text: string
}

// Customer/service/artist names are user-entered (an admin typing a walk-in's
// name, a customer registering) and get interpolated straight into HTML —
// without this, a name like `<img src=x onerror=...>` would render as markup
// in the recipient's mail client. Plain-text bodies don't need it.
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

// Server-local time, same "server clock = salon clock" simplification as the
// rest of the backend (see PROJECT_STATUS.md's timezone note) — an email sent
// from a server in a different timezone than the salon would show the wrong
// hour here, which is one more reason that assumption is flagged.
export function formatAppointmentWhen(date: Date): string {
    const day = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    })
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    return `${day} at ${time}`
}

function formatShortDate(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

// Shared shape for every appointment email: a heading, a few paragraphs, an
// optional label/value details table, an optional button, and a footer line.
// Inline styles, no external images — kept deliberately simple per the same
// reasoning as skipping react-email (see passwordResetEmail below).
type LayoutArgs = {
    heading: string
    paragraphs: string[]
    details?: [label: string, value: string][]
    list?: string[]
    button?: { label: string; url: string }
    footer: string
}

function renderHtml({ heading, paragraphs, details, list, button, footer }: LayoutArgs): string {
    const paragraphHtml = paragraphs
        .map((p) => `<p style="font-size: 15px; line-height: 1.5;">${escapeHtml(p)}</p>`)
        .join("")

    const detailsHtml = details
        ? `<table style="font-size: 15px; line-height: 1.6; margin: 16px 0; border-collapse: collapse;">${details
              .map(
                  ([label, value]) =>
                      `<tr><td style="color: #666666; padding-right: 16px; vertical-align: top;">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
              )
              .join("")}</table>`
        : ""

    const listHtml = list
        ? `<ul style="font-size: 15px; line-height: 1.6; padding-left: 20px;">${list
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
        : ""

    const buttonHtml = button
        ? `<p style="margin: 24px 0;"><a href="${escapeHtml(button.url)}" style="background: #2a2a2a; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-size: 15px; display: inline-block;">${escapeHtml(button.label)}</a></p>`
        : ""

    return `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #2a2a2a;">
            <h1 style="font-size: 20px; margin-bottom: 16px;">${escapeHtml(heading)}</h1>
            ${paragraphHtml}${detailsHtml}${listHtml}${buttonHtml}
            <p style="font-size: 13px; color: #666666; line-height: 1.5;">${escapeHtml(footer)}</p>
        </div>
    `.trim()
}

function renderText({ heading, paragraphs, details, list, button, footer }: LayoutArgs): string {
    const lines: string[] = [heading, ""]
    for (const p of paragraphs) lines.push(p, "")
    if (details) {
        for (const [label, value] of details) lines.push(`${label}: ${value}`)
        lines.push("")
    }
    if (list) {
        for (const item of list) lines.push(`- ${item}`)
        lines.push("")
    }
    if (button) lines.push(`${button.label}: ${button.url}`, "")
    lines.push(footer)
    return lines.join("\n")
}

function render(subject: string, layout: LayoutArgs): RenderedEmail {
    return { subject, html: renderHtml(layout), text: renderText(layout) }
}

// Everything an appointment email needs to describe one booking.
// `manageUrl`/`bookUrl` are null for a customer who can't sign in (an
// admin-created walk-in has no password and no OAuth account), since a link
// to a page they can't use would be worse than none.
export type AppointmentEmailDetails = {
    customerName: string | null
    serviceName: string
    artistName: string
    startTime: Date
    durationMinutes: number
    priceCents: number
    manageUrl: string | null
    bookUrl: string | null
}

function greeting(name: string | null): string {
    return name ? `Hi ${name},` : "Hi,"
}

function appointmentDetails(a: AppointmentEmailDetails): [string, string][] {
    return [
        ["When", formatAppointmentWhen(a.startTime)],
        ["Service", `${a.serviceName} (${formatDuration(a.durationMinutes)})`],
        ["With", a.artistName],
    ]
}

function manageButton(manageUrl: string | null): LayoutArgs["button"] {
    return manageUrl ? { label: "View My Bookings", url: manageUrl } : undefined
}

const CHANGE_FOOTER = "Need to change something? Contact the salon, or manage your booking online at least 24 hours in advance."
const CONTACT_FOOTER = "Questions? Contact the salon directly."

export function bookingConfirmationEmail(a: AppointmentEmailDetails): RenderedEmail {
    return render(`You're booked: ${a.serviceName} on ${formatShortDate(a.startTime)}`, {
        heading: "Your appointment is booked",
        // SITE_NAME ends in a period ("Inc."), so sentences here are worded
        // to never end on it — otherwise every email reads "Inc..".
        paragraphs: [greeting(a.customerName), `Thanks for booking with ${SITE_NAME} — here are your details:`],
        details: [...appointmentDetails(a), ["Price", formatPrice(a.priceCents)]],
        button: manageButton(a.manageUrl),
        footer: CHANGE_FOOTER,
    })
}

export function appointmentReminderEmail(a: AppointmentEmailDetails): RenderedEmail {
    return render(`Reminder: ${a.serviceName} on ${formatShortDate(a.startTime)}`, {
        heading: "See you soon",
        paragraphs: [greeting(a.customerName), `This is a reminder of your upcoming ${SITE_NAME} appointment.`],
        details: appointmentDetails(a),
        button: manageButton(a.manageUrl),
        footer: "If you can no longer make it, please contact the salon as soon as possible.",
    })
}

export function appointmentRescheduledEmail(
    a: AppointmentEmailDetails & { previousStartTime: Date },
): RenderedEmail {
    return render(`Your appointment has moved to ${formatShortDate(a.startTime)}`, {
        heading: "Your appointment has been rescheduled",
        paragraphs: [
            greeting(a.customerName),
            `Your ${a.serviceName} appointment, previously ${formatAppointmentWhen(a.previousStartTime)}, has a new time:`,
        ],
        details: appointmentDetails(a),
        button: manageButton(a.manageUrl),
        footer: CHANGE_FOOTER,
    })
}

export function appointmentCancelledEmail(
    a: AppointmentEmailDetails & { cancelledBy: "customer" | "salon" },
): RenderedEmail {
    const intro =
        a.cancelledBy === "salon"
            ? `We're sorry — ${SITE_NAME} has had to cancel your appointment.`
            : "Your appointment has been cancelled, as requested."

    return render(`Cancelled: ${a.serviceName} on ${formatShortDate(a.startTime)}`, {
        heading: "Your appointment has been cancelled",
        paragraphs: [greeting(a.customerName), intro],
        details: appointmentDetails(a),
        button: a.bookUrl ? { label: "Book Again", url: a.bookUrl } : undefined,
        footer: CONTACT_FOOTER,
    })
}

export function receiptEmail(
    a: AppointmentEmailDetails & { paymentMethodLabel: string; checkedOutAt: Date },
): RenderedEmail {
    return render(`Your receipt from ${SITE_NAME}`, {
        heading: "Thanks for visiting",
        paragraphs: [greeting(a.customerName), `Here's a record of your ${SITE_NAME} visit.`],
        details: [
            ...appointmentDetails(a),
            ["Total", formatPrice(a.priceCents)],
            ["Paid by", a.paymentMethodLabel],
            ["Checked out", formatAppointmentWhen(a.checkedOutAt)],
        ],
        footer: "Payment was taken in the salon. This email is for your records only.",
    })
}

type SeriesEmailDetails = {
    customerName: string | null
    serviceName: string
    artistName: string
    intervalWeeks: number
    manageUrl: string | null
}

function cadence(intervalWeeks: number): string {
    return intervalWeeks === 1 ? "every week" : `every ${intervalWeeks} weeks`
}

export function recurringConfirmationEmail(
    s: SeriesEmailDetails & { occurrences: Date[]; skippedDates: Date[] },
): RenderedEmail {
    const paragraphs = [
        greeting(s.customerName),
        `Your standing ${s.serviceName} appointment with ${s.artistName}, ${cadence(s.intervalWeeks)}, is set up. These dates are booked:`,
    ]

    const footerParts = [
        "You'll get a reminder the day before each visit.",
    ]
    if (s.skippedDates.length > 0) {
        // Skipped occurrences hit a real conflict (time off, an existing
        // booking) — worth telling the customer rather than letting them
        // assume every week is held.
        footerParts.unshift(
            `These dates couldn't be booked because the time wasn't available: ${s.skippedDates.map(formatShortDate).join(", ")}.`,
        )
    }

    return render(`Standing appointment booked: ${s.serviceName}, ${cadence(s.intervalWeeks)}`, {
        heading: "Your standing appointment is booked",
        paragraphs,
        list: s.occurrences.map(formatAppointmentWhen),
        button: manageButton(s.manageUrl),
        footer: footerParts.join(" "),
    })
}

export function recurringStatusChangedEmail(
    s: SeriesEmailDetails & {
        status: "PAUSED" | "CANCELLED"
        changedBy: "customer" | "salon"
        cancelledOccurrences: Date[]
    },
): RenderedEmail {
    const verb = s.status === "PAUSED" ? "paused" : "cancelled"
    const who = s.changedBy === "salon" ? `${SITE_NAME} has ${verb}` : `You've ${verb}`

    const paragraphs = [
        greeting(s.customerName),
        `${who} your standing ${s.serviceName} appointment with ${s.artistName} (${cadence(s.intervalWeeks)}).`,
    ]
    if (s.cancelledOccurrences.length > 0) {
        paragraphs.push("These upcoming appointments have been cancelled:")
    }

    return render(`Standing appointment ${verb}: ${s.serviceName}`, {
        heading: `Your standing appointment has been ${verb}`,
        paragraphs,
        list: s.cancelledOccurrences.length > 0 ? s.cancelledOccurrences.map(formatAppointmentWhen) : undefined,
        button: manageButton(s.manageUrl),
        footer: CONTACT_FOOTER,
    })
}

export function recurringResumedEmail(
    s: SeriesEmailDetails & { upcoming: Date[]; couldNotRestore: Date[] },
): RenderedEmail {
    const paragraphs = [
        greeting(s.customerName),
        `Your standing ${s.serviceName} appointment with ${s.artistName} (${cadence(s.intervalWeeks)}) is back on.`,
    ]
    if (s.upcoming.length > 0) paragraphs.push("Your upcoming appointments:")

    const footer =
        s.couldNotRestore.length > 0
            ? `These dates couldn't be restored because the time is no longer available: ${s.couldNotRestore.map(formatShortDate).join(", ")}. ${CONTACT_FOOTER}`
            : "You'll get a reminder the day before each visit."

    return render(`Standing appointment resumed: ${s.serviceName}`, {
        heading: "Your standing appointment has resumed",
        paragraphs,
        list: s.upcoming.length > 0 ? s.upcoming.map(formatAppointmentWhen) : undefined,
        button: manageButton(s.manageUrl),
        footer,
    })
}

// Sent by the daily materialization job when a week of a standing
// appointment couldn't be booked — once per week, never repeated, since
// skipped weeks are never retried.
export function recurringSkippedWeeksEmail(s: SeriesEmailDetails & { skippedDates: Date[] }): RenderedEmail {
    const plural = s.skippedDates.length > 1
    return render(`We couldn't book ${plural ? "some dates" : "a date"} for your standing appointment`, {
        heading: `${plural ? "Some dates" : "A date"} couldn't be booked`,
        paragraphs: [
            greeting(s.customerName),
            `We couldn't book your standing ${s.serviceName} appointment with ${s.artistName} on ${plural ? "these dates" : "this date"} because the time wasn't available:`,
        ],
        list: s.skippedDates.map(formatAppointmentWhen),
        button: manageButton(s.manageUrl),
        footer: "Your standing appointment continues as normal on other dates. If you'd like a different time for these dates, contact the salon.",
    })
}

type PasswordResetEmailArgs = {
    resetUrl: string
}

// Plain functions returning strings, not a templating library — react-email
// has a documented Cloudflare Workers startup-CPU failure (pulling React +
// its component library into the bundle blows the Workers cold-start budget),
// and this project's Cloudflare adapter question is already unresolved. Not
// worth adding a second unproven variable. Revisit only if the number of
// templates grows past a handful.
export function passwordResetEmail({ resetUrl }: PasswordResetEmailArgs): RenderedEmail {
    return render(`Reset your ${SITE_NAME} password`, {
        heading: "Reset your password",
        paragraphs: [`We received a request to reset your ${SITE_NAME} password.`],
        button: { label: "Reset Password", url: resetUrl },
        footer: "This link expires in 15 minutes. If you didn't request this, you can ignore this email — your password hasn't been changed.",
    })
}
