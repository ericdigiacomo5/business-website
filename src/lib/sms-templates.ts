// Every text message the app sends, as plain strings. Pure (no server
// imports), so the wording is unit-tested and quoted verbatim in the 10DLC
// campaign's sample messages (docs/SMS_10DLC.md).
//
// Rules each message follows:
//   - Starts with the business name (carriers require the sender to be
//     identified in every message).
//   - Ends with the opt-out instruction.
//   - Transactional only: about an appointment the customer has, never a
//     promotion (a promotion would need a different campaign and consent).
//   - Only the GSM-7 character set. One character outside it (an emoji, a
//     curly quote, the narrow no-break space Intl puts before "AM") switches
//     the whole message to UCS-2, where a segment holds 70 characters
//     instead of 160 — roughly doubling the cost.
//   - Aim for one segment (160 GSM-7 characters); the tests check typical
//     values fit.

import { SITE_NAME } from "@/lib/site"
import { formatSalonDate, formatSalonTime, zonedParts } from "@/lib/salon-time"
import { SMS_FREQUENCY } from "@/lib/sms-consent"

const OPT_OUT = "Reply STOP to opt out."

// ---- GSM-7 ----

const GSM_BASIC =
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
// Allowed, but each takes two characters' space.
const GSM_EXTENDED = "^{}\\[~]|€"

const REPLACEMENTS: Record<string, string> = {
    " ": " ", // no-break space
    " ": " ", // narrow no-break space (Intl, before AM/PM)
    " ": " ", // thin space (Intl, in some ranges)
    "‘": "'",
    "’": "'",
    "“": '"',
    "”": '"',
    "–": "-",
    "—": "-",
    "…": "...",
}

// The text with every character in the GSM-7 set: common typography is
// replaced, accented letters outside the set lose their accent (á → a), and
// anything else (emoji) is dropped.
export function toGsm7(text: string): string {
    let result = ""
    for (const char of text) {
        const replaced = REPLACEMENTS[char] ?? char
        for (const c of replaced) {
            if (GSM_BASIC.includes(c) || GSM_EXTENDED.includes(c)) {
                result += c
                continue
            }
            const plain = c.normalize("NFD").replace(/[̀-ͯ]/g, "")
            if (plain.length > 0 && [...plain].every((p) => GSM_BASIC.includes(p))) result += plain
        }
    }
    return result.replace(/ {2,}/g, " ").trim()
}

// How many segments a GSM-7 message is billed as: one up to 160 characters,
// then 153 per segment (the rest holds the joining header).
export function gsm7Segments(text: string): number {
    const length = [...text].reduce((sum, c) => sum + (GSM_EXTENDED.includes(c) ? 2 : 1), 0)
    return length <= 160 ? 1 : Math.ceil(length / 153)
}

// ---- When ----

// Texts the app sends on its own (reminders, a backlog of "Reply YES"
// requests) go out only between 8 AM and 9 PM on the salon's clock, the
// window the TCPA uses for calls and texts and what carriers expect.
// Texts answering something just done (booking, cancelling) go at once.
export const TEXTING_HOURS = { start: 8, end: 21 } as const

export function isWithinTextingHours(now: Date): boolean {
    const { hour } = zonedParts(now)
    return hour >= TEXTING_HOURS.start && hour < TEXTING_HOURS.end
}

// ---- Pieces ----

// "Thu, Oct 23 at 10:00 AM", on the salon's clock.
function when(date: Date): string {
    return `${formatSalonDate(date, { weekday: "short", month: "short", day: "numeric" })} at ${formatSalonTime(date)}`
}

// "nailimage.com/appointments": no "https://" (phones link a bare domain,
// and it saves 8 characters). Null for a walk-in, who can't sign in.
export function shortLink(url: string | null): string | null {
    return url ? url.replace(/^https?:\/\//, "") : null
}

function message(...parts: (string | null | false)[]): string {
    return toGsm7([`${SITE_NAME}:`, ...parts.filter(Boolean), OPT_OUT].join(" "))
}

// ---- Messages ----

// Sent once when a customer ticks the box (double opt-in): texts start only
// after they reply YES, so a mistyped or someone else's number never gets
// appointment details.
export function optInRequestSms(): string {
    return toGsm7(
        `${SITE_NAME}: Reply YES to get appointment texts (${SMS_FREQUENCY}). ` +
            "Msg & data rates may apply. Reply HELP for help, STOP to opt out.",
    )
}

// The reply to YES: the carrier-required opt-in confirmation (program, how
// often, rates, HELP, STOP). With Twilio's Advanced Opt-Out turned on,
// Twilio sends its own copy of this (set it to this same text, see
// docs/SMS_10DLC.md) and the webhook replies with nothing.
export function optInConfirmedSms(): string {
    return toGsm7(
        `${SITE_NAME}: You're signed up for appointment texts, ${SMS_FREQUENCY}. ` +
            "Msg & data rates may apply. Reply HELP for help, STOP to opt out.",
    )
}

type AppointmentSmsDetails = {
    artistName: string
    startTime: Date
    // Where to manage bookings, or null for a walk-in.
    manageUrl: string | null
}

export function bookingConfirmationSms({ artistName, startTime, manageUrl }: AppointmentSmsDetails): string {
    const link = shortLink(manageUrl)
    return message(`You're booked with ${artistName} on ${when(startTime)}.`, link && `Manage: ${link}`)
}

export function rescheduleSms({ artistName, startTime, manageUrl }: AppointmentSmsDetails): string {
    const link = shortLink(manageUrl)
    return message(`Your appointment with ${artistName} moved to ${when(startTime)}.`, link && `Details: ${link}`)
}

export function cancellationSms({
    artistName,
    startTime,
    cancelledBy,
}: Omit<AppointmentSmsDetails, "manageUrl"> & { cancelledBy: "customer" | "salon" }): string {
    const what = `Your ${when(startTime)} appointment with ${artistName} is cancelled.`
    return message(what, cancelledBy === "salon" && "Sorry! Call or book online for a new time.")
}

export function reminderSms({ artistName, startTime, manageUrl }: AppointmentSmsDetails): string {
    const link = shortLink(manageUrl)
    return message(`Reminder: ${artistName}, ${when(startTime)}.`, link && `To change: ${link}`)
}

export function recurringConfirmationSms({
    artistName,
    firstStart,
    visits,
    intervalWeeks,
}: {
    artistName: string
    firstStart: Date
    visits: number
    intervalWeeks: number
}): string {
    const every = intervalWeeks === 1 ? "every week" : `every ${intervalWeeks} weeks`
    return message(
        `Standing appointment booked with ${artistName}, ${every}: ${visits} ${visits === 1 ? "visit" : "visits"} from ${when(firstStart)}.`,
        "Details by email.",
    )
}

export function recurringCancelledSms({ artistName, visits }: { artistName: string; visits: number }): string {
    return message(
        `Your standing appointment with ${artistName} is cancelled (${visits} upcoming ${visits === 1 ? "visit" : "visits"}).`,
    )
}
