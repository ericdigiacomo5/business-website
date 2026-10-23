import { SALON_CONTACT, SITE_NAME, formatPhone } from "@/lib/site"
import { formatDuration, formatPrice } from "@/lib/format"
import { amountDueCents, describeDiscount, discountCents, totalCents, type Discount } from "@/lib/discount"
import { describeNoticeWindow } from "@/lib/recurring"
import { formatSalonDate, formatSalonTime } from "@/lib/salon-time"

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

// On the salon's clock (salon-time.ts), whatever zone the server runs in.
export function formatAppointmentWhen(date: Date): string {
    const day = formatSalonDate(date, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    })
    return `${day} at ${formatSalonTime(date)}`
}

function formatShortDate(date: Date): string {
    return formatSalonDate(date, { weekday: "short", month: "short", day: "numeric" })
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
    // A quieter text link under the button (the receipt's review link).
    secondaryLink?: { label: string; url: string }
    footer: string
}

// The salon's theme, as literal hex: mail clients don't support CSS
// variables. Same values as src/app/globals.css (and the same AA-checked
// pairs: navy on gold 5.1:1, grey on cream 5.5:1).
const EMAIL = {
    page: "#f6ead9",
    card: "#fbf3e7",
    navy: "#16212c",
    gold: "#b8863b",
    goldText: "#8a5f1e",
    text: "#16212c",
    muted: "#52606c",
    onNavy: "#d8e2ea",
    border: "#e6c8a4",
    // Web fonts don't load reliably in mail clients, so a serif stack for
    // headings (the site's Bodoni Moda look) and a system sans for the rest.
    serif: "Georgia, 'Times New Roman', serif",
    sans: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
}

// The salon's address and phone, from SALON_CONTACT — each shown once set.
function contactLines(): string[] {
    return [SALON_CONTACT.address, SALON_CONTACT.phone ? formatPhone(SALON_CONTACT.phone) : null].filter(
        (line): line is string => line !== null,
    )
}

// Table-based and inline-styled throughout — what Outlook and Gmail render
// consistently (FEATURE_GAPS.md U10). No images, so it reads the same with
// images blocked; the "logo" is the salon name in the header band.
function renderHtml({ heading, paragraphs, details, list, button, secondaryLink, footer }: LayoutArgs): string {
    const paragraphHtml = paragraphs
        .map((p) => `<p style="margin: 0 0 14px; font-size: 15px; line-height: 1.55; color: ${EMAIL.text};">${escapeHtml(p)}</p>`)
        .join("")

    const detailsHtml = details
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 15px; line-height: 1.6; margin: 8px 0 18px; border-collapse: collapse; border-top: 1px solid ${EMAIL.border};">${details
              .map(
                  ([label, value]) =>
                      `<tr><td style="color: ${EMAIL.muted}; padding: 8px 16px 8px 0; vertical-align: top; border-bottom: 1px solid ${EMAIL.border}; white-space: nowrap;">${escapeHtml(label)}</td><td style="color: ${EMAIL.text}; padding: 8px 0; border-bottom: 1px solid ${EMAIL.border};">${escapeHtml(value)}</td></tr>`,
              )
              .join("")}</table>`
        : ""

    const listHtml = list
        ? `<ul style="margin: 0 0 18px; font-size: 15px; line-height: 1.6; padding-left: 20px; color: ${EMAIL.text};">${list
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
        : ""

    const buttonHtml = button
        ? `<p style="margin: 24px 0 8px;"><a href="${escapeHtml(button.url)}" style="background: ${EMAIL.gold}; color: ${EMAIL.navy}; border: 1px solid ${EMAIL.navy}; padding: 13px 22px; text-decoration: none; border-radius: 3px; font-family: ${EMAIL.sans}; font-size: 14px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; display: inline-block;">${escapeHtml(button.label)}</a></p>`
        : ""

    const secondaryHtml = secondaryLink
        ? `<p style="margin: 16px 0 0; font-size: 14px;"><a href="${escapeHtml(secondaryLink.url)}" style="color: ${EMAIL.goldText}; font-weight: bold;">${escapeHtml(secondaryLink.label)} &rarr;</a></p>`
        : ""

    const contactHtml = contactLines()
        .map((line) => `${escapeHtml(line)}<br>`)
        .join("")

    return `
<div style="margin: 0; padding: 24px 12px; background: ${EMAIL.page};">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="width: 100%; max-width: 520px; margin: 0 auto; border-collapse: collapse; font-family: ${EMAIL.sans};">
    <tr><td style="background: ${EMAIL.navy}; padding: 20px 28px; border-bottom: 3px solid ${EMAIL.gold};">
      <div style="font-family: ${EMAIL.serif}; font-size: 22px; font-weight: bold; letter-spacing: 0.08em; color: #ffffff;">${escapeHtml(SITE_NAME.toUpperCase())}</div>
      <div style="font-family: ${EMAIL.serif}; font-style: italic; font-size: 14px; color: ${EMAIL.gold};">Amityville, N.Y.</div>
    </td></tr>
    <tr><td style="background: ${EMAIL.card}; padding: 28px; border: 1px solid ${EMAIL.border}; border-top: 0;">
      <h1 style="margin: 0 0 16px; font-family: ${EMAIL.serif}; font-size: 24px; line-height: 1.25; color: ${EMAIL.navy};">${escapeHtml(heading)}</h1>
      ${paragraphHtml}${detailsHtml}${listHtml}${buttonHtml}${secondaryHtml}
    </td></tr>
    <tr><td style="padding: 18px 28px; font-size: 13px; line-height: 1.55; color: ${EMAIL.muted};">
      ${escapeHtml(footer)}<br><br>
      <strong style="color: ${EMAIL.navy};">${escapeHtml(SITE_NAME)}</strong><br>
      ${contactHtml}
    </td></tr>
  </table>
</div>
    `.trim()
}

function renderText({ heading, paragraphs, details, list, button, secondaryLink, footer }: LayoutArgs): string {
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
    if (secondaryLink) lines.push(`${secondaryLink.label}: ${secondaryLink.url}`, "")
    lines.push(footer, "", SITE_NAME, ...contactLines())
    return lines.join("\n")
}

function render(subject: string, layout: LayoutArgs): RenderedEmail {
    return { subject, html: renderHtml(layout), text: renderText(layout) }
}

// Everything an appointment email needs to describe one booking.
// `manageUrl`/`bookUrl` are null for a customer who can't sign in (an
// admin-created walk-in has no password), since a link
// to a page they can't use would be worse than none.
export type AppointmentEmailDetails = {
    customerName: string | null
    serviceName: string
    artistName: string
    startTime: Date
    durationMinutes: number
    priceCents: number
    // Only ever set by an admin before checkout, so in practice only the
    // receipt has one to show.
    discount: Discount | null
    manageUrl: string | null
    bookUrl: string | null
    // The salon's online cancel/reschedule window (AppSettings), for the
    // "need to change something?" footer.
    cancellationNoticeHours: number
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

function changeFooter(a: AppointmentEmailDetails): string {
    return `Need to change something? Contact the salon, or reschedule or cancel online at least ${describeNoticeWindow(a.cancellationNoticeHours)} in advance.`
}
const CONTACT_FOOTER = "Questions? Contact the salon directly."

export function bookingConfirmationEmail(a: AppointmentEmailDetails): RenderedEmail {
    return render(`You're booked: ${a.serviceName} on ${formatShortDate(a.startTime)}`, {
        heading: "Your appointment is booked",
        // SITE_NAME ends in a period ("Inc."), so sentences here are worded
        // to never end on it — otherwise every email reads "Inc..".
        paragraphs: [greeting(a.customerName), `Thanks for booking with ${SITE_NAME} — here are your details:`],
        details: [...appointmentDetails(a), ["Price", formatPrice(a.priceCents)]],
        button: manageButton(a.manageUrl),
        footer: changeFooter(a),
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
        footer: changeFooter(a),
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
    a: AppointmentEmailDetails & {
        // Null when store credit covered the whole visit (nothing went
        // through the POS).
        paymentMethodLabel: string | null
        creditAppliedCents: number
        checkedOutAt: Date
    },
): RenderedEmail {
    const dueCents = amountDueCents(a.priceCents, a.discount, a.creditAppliedCents)
    return render(`Your receipt from ${SITE_NAME}`, {
        heading: "Thanks for visiting",
        paragraphs: [greeting(a.customerName), `Here's a record of your ${SITE_NAME} visit.`],
        details: [
            ...appointmentDetails(a),
            ...(a.discount
                ? ([
                      ["Price", formatPrice(a.priceCents)],
                      ["Discount", `${describeDiscount(a.discount)} (-${formatPrice(discountCents(a.priceCents, a.discount))})`],
                  ] as [string, string][])
                : []),
            ["Total", formatPrice(totalCents(a.priceCents, a.discount))],
            ...(a.creditAppliedCents > 0
                ? ([
                      ["Store credit", `-${formatPrice(a.creditAppliedCents)}`],
                      ["Paid in salon", formatPrice(dueCents)],
                  ] as [string, string][])
                : []),
            ["Paid by", a.paymentMethodLabel ?? "Store credit"],
            ["Checked out", formatAppointmentWhen(a.checkedOutAt)],
        ],
        // Shown only once the salon's review link is set (SALON_CONTACT).
        secondaryLink: SALON_CONTACT.reviewUrl
            ? { label: "Loved your nails? Leave us a review", url: SALON_CONTACT.reviewUrl }
            : undefined,
        footer: "Payment was taken in the salon. This email is for your records only.",
    })
}

// Sent when a gift card is redeemed onto an account, by the customer or by
// staff at the desk.
export function creditAddedEmail(c: {
    customerName: string | null
    addedCents: number
    balanceCents: number
    // Null for a walk-in who can't sign in (same rule as manageUrl).
    accountUrl: string | null
}): RenderedEmail {
    return render(`${formatPrice(c.addedCents)} gift card added to your account`, {
        heading: "Your gift card has been added",
        paragraphs: [
            greeting(c.customerName),
            `A ${formatPrice(c.addedCents)} gift card is now store credit on your ${SITE_NAME} account. It's applied at checkout when you visit — no need to bring the card.`,
        ],
        details: [
            ["Added", formatPrice(c.addedCents)],
            ["Your balance", formatPrice(c.balanceCents)],
        ],
        button: c.accountUrl ? { label: "View My Account", url: c.accountUrl } : undefined,
        footer: "Store credit never expires. Questions? Contact the salon directly.",
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

export function recurringCancelledEmail(
    s: SeriesEmailDetails & {
        changedBy: "customer" | "salon"
        cancelledOccurrences: Date[]
    },
): RenderedEmail {
    const who = s.changedBy === "salon" ? `${SITE_NAME} has cancelled` : "You've cancelled"

    const paragraphs = [
        greeting(s.customerName),
        `${who} your standing ${s.serviceName} appointment with ${s.artistName} (${cadence(s.intervalWeeks)}).`,
    ]
    if (s.cancelledOccurrences.length > 0) {
        paragraphs.push("These upcoming appointments have been cancelled:")
    }

    return render(`Standing appointment cancelled: ${s.serviceName}`, {
        heading: "Your standing appointment has been cancelled",
        paragraphs,
        list: s.cancelledOccurrences.length > 0 ? s.cancelledOccurrences.map(formatAppointmentWhen) : undefined,
        button: manageButton(s.manageUrl),
        footer: CONTACT_FOOTER,
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

// Neither email below includes anything the account holder typed (no name,
// no greeting). Anyone can enter any address at registration, so these are
// the only emails an unverified address ever gets, and they must not be a
// way to deliver someone's own text from the salon's domain.
type EmailVerificationEmailArgs = {
    verifyUrl: string
    // "signup": confirming a new account's address. "change": confirming a
    // new address before it replaces the old one.
    purpose: "signup" | "change"
}

export function emailVerificationEmail({ verifyUrl, purpose }: EmailVerificationEmailArgs): RenderedEmail {
    return render(`Confirm your email for ${SITE_NAME}`, {
        heading: "Confirm your email",
        paragraphs: [
            purpose === "signup"
                ? `Please confirm this is your email address to finish setting up your ${SITE_NAME} account.`
                : `Please confirm this is your email address. Your ${SITE_NAME} account will switch to it once you do.`,
        ],
        button: { label: "Confirm Email", url: verifyUrl },
        footer: "This link expires in 24 hours. If you didn't request this, you can ignore this email — nothing will change.",
    })
}

// Sent to the OLD address once an email change is confirmed, so a change the
// owner didn't make (a stolen session) doesn't go unnoticed.
export function emailChangedEmail({ newEmail }: { newEmail: string }): RenderedEmail {
    return render(`Your ${SITE_NAME} email was changed`, {
        heading: "Your email was changed",
        paragraphs: [
            `The email address on your ${SITE_NAME} account was just changed to ${newEmail}. Sign-in and booking emails will go there from now on.`,
            "If you didn't make this change, contact the salon right away.",
        ],
        footer: "You're receiving this because this address was on the account until now.",
    })
}
