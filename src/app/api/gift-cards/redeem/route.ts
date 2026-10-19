import { after } from "next/server"
import { requireUser } from "@/lib/require-user"
import { readJsonObject } from "@/lib/request"
import { InvalidGiftCardError, redeemGiftCard } from "@/lib/gift-cards"
import { sendCreditAdded } from "@/lib/appointment-emails"

// A signed-in customer redeeming a printed gift card onto their own account.
// Body: { code }. The one place a stranger could try guessing codes: 80
// random bits makes that hopeless, and the edge rate limit in
// docs/DEPLOY_RUNBOOK.md caps attempts anyway.
export async function POST(request: Request) {
    const userId = await requireUser()
    if (userId instanceof Response) return userId

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    try {
        const result = await redeemGiftCard({ code: body.code, userId, actorId: userId })
        after(() => sendCreditAdded(userId, result.addedCents))
        return Response.json({ data: result })
    } catch (error) {
        if (error instanceof InvalidGiftCardError) {
            return Response.json({ error: error.message }, { status: 400 })
        }
        throw error
    }
}
