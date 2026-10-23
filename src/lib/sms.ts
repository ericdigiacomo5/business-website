// Sends one text message through Twilio's REST API (raw fetch, no SDK, the
// same way email.ts calls Resend: nothing added to the Workers bundle).
// Server-only — it reads the Twilio secrets.
//
// Never throws: a booking must still succeed if its confirmation text fails.
//
// Three modes, by configuration:
//   - Configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
//     TWILIO_MESSAGING_SERVICE_SID all set): sends.
//   - Not configured, development: prints the text to the console instead
//     ("[sms:dev] would send"), so every texting flow can be tried locally
//     without an account or any cost.
//   - Not configured, production: sends nothing, quietly. That's the normal
//     state until the 10DLC campaign is approved (docs/SMS_10DLC.md), so it
//     isn't reported as an error. Opt-ins made meanwhile are kept, and their
//     "Reply YES" texts go out on the first job run once it's configured.

import { errorMessage, reportError } from "@/lib/report-error"

export type SmsResult =
    | { ok: true; sid: string | null; status: string }
    | {
          ok: false
          // Texting isn't set up (production without Twilio settings).
          notConfigured: boolean
          // Twilio refused because the number replied STOP (error 21610).
          optedOut: boolean
          errorCode: string | null
      }

// Twilio: "Attempt to send to unsubscribed recipient".
export const TWILIO_OPTED_OUT_CODE = "21610"

export function isSmsConfigured(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_SERVICE_SID)
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

    if (!accountSid || !authToken || !messagingServiceSid) {
        if (process.env.NODE_ENV === "production") {
            return { ok: false, notConfigured: true, optedOut: false, errorCode: null }
        }
        console.log("[sms:dev] would send:", { to, body })
        return { ok: true, sid: null, status: "dev" }
    }

    const form = new URLSearchParams({ To: to, MessagingServiceSid: messagingServiceSid, Body: body })
    // Delivery updates (delivered / undelivered / failed) come back to the
    // status webhook. Only when the public URL is known.
    if (process.env.NEXT_PUBLIC_APP_URL) {
        form.set("StatusCallback", `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/status`)
    }

    try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form,
        })
        const json = (await res.json().catch(() => null)) as { sid?: string; status?: string; code?: number; message?: string } | null

        if (!res.ok) {
            const errorCode = json?.code ? String(json.code) : null
            const optedOut = errorCode === TWILIO_OPTED_OUT_CODE
            // An opted-out number is expected (the caller records it), not an
            // incident. Neither the number nor the body goes in the report.
            if (!optedOut) {
                await reportError({ event: "sms_failed", message: `Twilio returned ${res.status} (code ${errorCode ?? "none"}): ${json?.message ?? ""}` })
            }
            return { ok: false, notConfigured: false, optedOut, errorCode }
        }

        return { ok: true, sid: json?.sid ?? null, status: json?.status ?? "queued" }
    } catch (error) {
        await reportError({ event: "sms_failed", message: `Twilio request threw: ${errorMessage(error)}` })
        return { ok: false, notConfigured: false, optedOut: false, errorCode: null }
    }
}
