// Request guards shared by every mutating route.
//
// CSRF: the Auth.js session cookie is SameSite=Lax, which stops other
// *sites* from sending it on a POST — but not other origins on the same
// site (any subdomain of the salon's domain). These two checks make the
// protection explicit instead of inherited from a cookie default:
//   - rejectCrossOrigin(): a browser always sends Origin on a cross-origin
//     POST/PATCH/DELETE, so one that doesn't match this site is refused.
//     No Origin at all (curl, the cron job, a future native app) is allowed
//     — those requests don't carry a victim's browser cookies.
//   - readJsonObject() also requires Content-Type: application/json. An
//     HTML form can only send urlencoded, multipart or text/plain — and a
//     text/plain form body CAN be valid JSON, so parsing alone never stopped
//     a form post (SECURITY_AUDIT L1). A JSON content type from another
//     origin needs a CORS preflight, which this app never grants.

// This site's own origins: AUTH_URL's (the canonical public URL, required in
// production) and the request's own, so dev and local builds without
// AUTH_URL still work.
function allowedOrigins(request: Request): Set<string> {
    const origins = new Set([new URL(request.url).origin])
    if (process.env.AUTH_URL) {
        try {
            origins.add(new URL(process.env.AUTH_URL).origin)
        } catch {
            // A malformed AUTH_URL already breaks Auth.js loudly; don't
            // also fail every mutation here.
        }
    }
    return origins
}

// For mutating routes that take no body (DELETE, and POSTs like the upload
// signature). readJsonObject() already calls this for the rest.
//
//   const crossOrigin = rejectCrossOrigin(request)
//   if (crossOrigin) return crossOrigin
export function rejectCrossOrigin(request: Request): Response | null {
    const origin = request.headers.get("origin")
    if (origin !== null && !allowedOrigins(request).has(origin)) {
        return Response.json({ error: "Cross-origin request refused" }, { status: 403 })
    }
    return null
}

// Every mutating route reads its body the same way: same-origin, sent as
// JSON, valid JSON, and a plain object (not an array, string, number or
// null) so fields can be destructured from it. Returns the object, or a
// 403/415/400 Response to return as-is — same Response-to-short-circuit
// shape as requireAdmin().
//
//   const body = await readJsonObject(request)
//   if (body instanceof Response) return body
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
    const crossOrigin = rejectCrossOrigin(request)
    if (crossOrigin) return crossOrigin

    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().startsWith("application/json")) {
        return Response.json({ error: "Send the request body as application/json" }, { status: 415 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return Response.json({ error: "Invalid request body" }, { status: 400 })
    }

    return body as Record<string, unknown>
}
