// Checks that a webhook request really came from Twilio. Twilio signs each
// request with the account's auth token: HMAC-SHA1 over the full URL it
// called followed by every POST parameter, sorted by name, as name + value
// with no separators, base64-encoded, in the X-Twilio-Signature header.
//
// Web Crypto, not Node's `crypto`, so it runs unchanged on Cloudflare
// Workers (same as job-auth.ts). Pure apart from crypto.subtle.

export async function twilioSignature(authToken: string, url: string, params: URLSearchParams): Promise<string> {
    const names = [...new Set(params.keys())].sort()
    let data = url
    for (const name of names) {
        // A repeated name contributes each of its values, in order.
        for (const value of params.getAll(name)) data += name + value
    }

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey("raw", encoder.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)))
    return btoa(String.fromCharCode(...mac))
}

export async function isValidTwilioSignature(
    authToken: string,
    url: string,
    params: URLSearchParams,
    signature: string | null,
): Promise<boolean> {
    if (!signature) return false
    return timingSafeEqual(await twilioSignature(authToken, url, params), signature)
}

// Constant-time, so response timing can't reveal how much of a forged
// signature matched.
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}
