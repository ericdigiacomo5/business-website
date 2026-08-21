import { auth } from "@/auth"

// Guard clause for any route that needs to act as "the current user" (as
// opposed to requireAdmin()'s role gate) — same Response-to-short-circuit
// shape, but returns the session's user id on success since callers need it
// to scope queries/writes to the caller, not whatever id the client sent.
export async function requireUser(): Promise<Response | string> {
    const session = await auth()

    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    return session.user.id
}
