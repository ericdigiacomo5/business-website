import { prisma } from "@/lib/prisma"
import { readTwilioRequest } from "@/lib/twilio-webhook"
import { TWILIO_OPTED_OUT_CODE } from "@/lib/sms"
import { optOutPhone } from "@/lib/sms-consent-data"

// Twilio's delivery-status callback, named in each send (StatusCallback in
// src/lib/sms.ts). Records what became of a text — "delivered",
// "undelivered", "failed" — on its SmsMessage row, so staff can tell whether
// a customer got their reminder. Signature-checked like the inbound webhook.
export async function POST(request: Request) {
    const params = await readTwilioRequest(request)
    if (params instanceof Response) return params

    const sid = params.get("MessageSid")
    const status = params.get("MessageStatus")
    if (sid && status) {
        const errorCode = params.get("ErrorCode") || null
        // updateMany: a callback for a message this app didn't log (sent
        // from Twilio's console, say) matches nothing, which is fine.
        await prisma.smsMessage.updateMany({ where: { providerSid: sid }, data: { status, errorCode } })

        const to = params.get("To")
        if (errorCode === TWILIO_OPTED_OUT_CODE && to) await optOutPhone(to, "carrier")
    }

    // Twilio only needs a 2xx.
    return new Response(null, { status: 204 })
}
