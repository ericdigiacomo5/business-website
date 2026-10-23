// Shared guard for Twilio's webhooks (POST /api/sms/inbound and
// /api/sms/status). Twilio posts form-encoded bodies with no session and no
// matching Origin, so these can't use readJsonObject(); instead every
// request must carry a valid X-Twilio-Signature made with the account's auth
// token. Same Response-or-value shape as readJsonObject().

import { isValidTwilioSignature } from "@/lib/twilio-signature"

export async function readTwilioRequest(request: Request): Promise<URLSearchParams | Response> {
    const authToken = process.env.TWILIO_AUTH_TOKEN
    // Fail closed: without the token nothing can be verified, and an
    // unverified request must never change anyone's consent.
    if (!authToken) {
        return Response.json({ error: "Texting is not configured" }, { status: 503 })
    }

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
        return Response.json({ error: "Unsupported content type" }, { status: 415 })
    }

    const params = new URLSearchParams(await request.text())

    // Twilio signs the URL exactly as configured in its console, which is
    // the public https:// address. Behind Cloudflare the request's own URL
    // should be the same, but the configured public URL is the one to trust.
    const { pathname, search } = new URL(request.url)
    const publicBase = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
    const signedUrl = `${publicBase.replace(/\/$/, "")}${pathname}${search}`

    if (!(await isValidTwilioSignature(authToken, signedUrl, params, request.headers.get("x-twilio-signature")))) {
        return Response.json({ error: "Invalid signature" }, { status: 403 })
    }

    return params
}

// TwiML: what Twilio should reply with. An empty <Response/> means "send
// nothing back".
export function twiml(message?: string): Response {
    const escaped = message
        ?.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    const body = escaped
        ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
        : `<?xml version="1.0" encoding="UTF-8"?><Response/>`
    return new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } })
}
