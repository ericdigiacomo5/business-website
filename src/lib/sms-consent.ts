// The SMS opt-in wording and status rules. Client-safe (no server imports):
// the register form and My Account show this text, and the server records
// which version of it a customer agreed to.
//
// Carrier rules this wording follows (CTIA Messaging Principles; Twilio's
// A2P 10DLC review): the program name, what is sent, how often, "message and
// data rates may apply", HELP and STOP, a link to the terms and privacy
// policy, and that consent isn't a condition of booking. The box is never
// pre-checked and booking never depends on it.
//
// Changing any wording below? Bump SMS_CONSENT_VERSION, so the consent log
// shows which text each customer saw — and update docs/SMS_10DLC.md, whose
// campaign description and screenshots must match the live site.

import { SITE_NAME } from "@/lib/site"

export const SMS_CONSENT_VERSION = "2026-10-22"

export const SMS_PROGRAM_NAME = `${SITE_NAME} appointment texts`

// How often texts come, worded the same everywhere it's stated (this
// disclosure, the opt-in request text, the terms).
export const SMS_FREQUENCY = "about 2 messages per booking"

// The checkbox label. The links to the terms and privacy policy are rendered
// next to it by SmsConsentCheckbox.
export const SMS_CONSENT_LABEL = `Text me appointment confirmations and reminders from ${SITE_NAME}.`

export const SMS_CONSENT_DETAILS =
    `Optional. We'll text you once to confirm — reply YES. Then ${SMS_FREQUENCY}, plus a text if one changes. ` +
    "Message and data rates may apply. Reply HELP for help or STOP to stop at any time. " +
    "Consent isn't a condition of booking. US mobile numbers only."

export type SmsStatus =
    // Not opted in.
    | "off"
    // Replied STOP: off until they text START (or YES) to the salon's number.
    | "stopped"
    // Ticked the box; waiting for the YES reply from the phone.
    | "waiting"
    // Confirmed: texts are being sent.
    | "on"

// What an incoming text asks for. Twilio's standard keywords: with Advanced
// Opt-Out turned on (docs/SMS_10DLC.md), Twilio itself replies to these, and
// blocks texts to a number that sent STOP. The webhook mirrors that on the
// account. Twilio also says which it was (OptOutType), so the body is only
// the fallback for when that field is missing.
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"])
const START_WORDS = new Set(["START", "YES", "Y", "UNSTOP"])

export function inboundKeyword(body: string, optOutType: string | null): "stop" | "start" | "help" | null {
    const type = optOutType?.toUpperCase()
    if (type === "STOP") return "stop"
    if (type === "START") return "start"
    if (type === "HELP") return "help"
    const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "")
    if (STOP_WORDS.has(word)) return "stop"
    if (START_WORDS.has(word)) return "start"
    if (word === "HELP" || word === "INFO") return "help"
    return null
}

// See the state table in sms-consent-data.ts.
export function smsStatusOf(user: { smsOptIn: boolean; smsPhone: string | null; smsConfirmedAt: Date | string | null }): SmsStatus {
    if (!user.smsOptIn) return user.smsPhone ? "stopped" : "off"
    return user.smsConfirmedAt ? "on" : "waiting"
}

// What to tell a customer whose number replied STOP. The carrier blocks
// texts to it until they text START themselves, so ticking the box can't
// help.
export function stoppedMessage(smsNumber: string | null): string {
    return `You replied STOP to our texts, so they're off. To turn them back on, text START to ${smsNumber ?? "the number our texts came from"}.`
}
