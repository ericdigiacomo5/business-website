import { readTwilioRequest, twiml } from "@/lib/twilio-webhook"
import { inboundKeyword } from "@/lib/sms-consent"
import { confirmPhone, optOutPhone } from "@/lib/sms-consent-data"
import { optInConfirmedSms } from "@/lib/sms-templates"

// Twilio's "a message came in" webhook (set on the Messaging Service, see
// docs/SMS_10DLC.md). Signature-checked, not session-checked: Twilio is the
// caller. Only keywords do anything:
//   - STOP (and its synonyms): texts stop for every account on that number.
//   - YES / START: confirms accounts that opted in on the site with that
//     number (the second half of the double opt-in).
//   - HELP and anything else: nothing here. Twilio answers HELP itself, and
//     the salon doesn't read replies in the app.
export async function POST(request: Request) {
    const params = await readTwilioRequest(request)
    if (params instanceof Response) return params

    const from = params.get("From")
    if (!from) return twiml()

    // Twilio fills OptOutType when Advanced Opt-Out handled the keyword (and
    // already replied); otherwise the body is checked here.
    const optOutType = params.get("OptOutType")
    const keyword = inboundKeyword(params.get("Body") ?? "", optOutType)

    if (keyword === "stop") {
        await optOutPhone(from, "sms_reply")
        return twiml()
    }

    if (keyword === "start") {
        const confirmed = await confirmPhone(from)
        // Twilio replied already if it recognised the keyword. If it didn't
        // (Advanced Opt-Out off, or "Y"), send the confirmation ourselves.
        return twiml(confirmed > 0 && !optOutType ? optInConfirmedSms() : undefined)
    }

    return twiml()
}
