import { auth } from "@/auth"

// Guard clause for admin routes, same shape as every other early-return check
// in this project (artist/service/user existence checks in the booking route,
// etc.): returns a Response to short-circuit with, or null to mean "proceed."
export async function requireAdmin() {
    const session = await auth()

    if (!session?.user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
        return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    return null
}
