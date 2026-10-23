import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/require-user"
import { readJsonObject } from "@/lib/request"
import { optInToSms, optOutOfSms } from "@/lib/sms-consent-data"
import { sendOptInRequest } from "@/lib/appointment-sms"
import { smsStatusOf, stoppedMessage } from "@/lib/sms-consent"
import { SALON_CONTACT, formatPhone } from "@/lib/site"

// The signed-in customer's own texting choice. Body: { optIn: boolean }.
// Turning it on (again) sends the "Reply YES" text — at most once a minute,
// so ticking it again is also how to get that text re-sent. A number that
// replied STOP gets 409 with how to text START instead. Response:
// { data: { status: "off" | "stopped" | "waiting" | "on", smsPhone } }.
export async function PATCH(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    if (typeof body.optIn !== "boolean") {
        return Response.json({ error: "optIn must be true or false" }, { status: 400 })
    }

    if (body.optIn) {
        const result = await optInToSms(userId, "account")
        if (!result.ok) {
            if (result.reason === "not_found") return Response.json({ error: "User not found" }, { status: 404 })
            if (result.reason === "stopped") {
                const number = SALON_CONTACT.smsNumber ? formatPhone(SALON_CONTACT.smsNumber) : null
                return Response.json({ error: stoppedMessage(number) }, { status: 409 })
            }
            return Response.json(
                { error: "Texts can only go to a US mobile number. Check the phone number in your profile above." },
                { status: 400 },
            )
        }
        if (!result.alreadyOn) after(() => sendOptInRequest(userId))
    } else {
        await optOutOfSms(userId, "account")
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { smsOptIn: true, smsConfirmedAt: true, smsPhone: true },
    })
    if (!user) return Response.json({ error: "User not found" }, { status: 404 })

    return Response.json({ data: { status: smsStatusOf(user), smsPhone: user.smsPhone } })
}
