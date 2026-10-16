// Every mutating route reads its body the same way: it must be valid JSON,
// and it must be a plain object (not an array, string, number or null) so
// fields can be destructured from it. Returns the object, or a 400 Response
// to return as-is — same Response-to-short-circuit shape as requireAdmin().
//
//   const body = await readJsonObject(request)
//   if (body instanceof Response) return body
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | Response> {
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
