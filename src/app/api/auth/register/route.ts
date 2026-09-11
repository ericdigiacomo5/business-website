import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isValidEmail, isValidPhone } from "@/lib/validation"

// Same cost factor as DUMMY_PASSWORD_HASH in src/auth.ts — keep these in sync,
// since a mismatch wouldn't break anything functionally, but would make the
// timing-safety comment in auth.ts inaccurate.
const BCRYPT_COST = 10

// No composition rules (no forced uppercase/number/symbol) — current
// guidance (NIST 800-63B) recommends against them, since they tend to push
// people toward predictable patterns ("Password1!") rather than actually
// stronger passwords. A length floor is the higher-value, lower-friction check.
const PASSWORD_MIN_LENGTH = 8

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== "object" || body === null) {
        return Response.json(
            { error: "Invalid request body" },
            { status: 400 }
        )
    }

    const { email, password, phone } = body as Record<string, unknown>

    if (!isValidEmail(email)) {
        return Response.json(
            { error: "A valid email is required" },
            { status: 400 }
        )
    }

    if (!password || typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
        return Response.json(
            { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
            { status: 400 }
        )
    }

    if (!isValidPhone(phone)) {
        return Response.json(
            { error: "A phone number is required" },
            { status: 400 }
        )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
        return Response.json(
            { error: "An account with that email already exists" },
            { status: 409 }
        )
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    const user = await prisma.user.create({
        data: { email, phone, passwordHash },
    })

    // Scrubbed response — never echo passwordHash back, same reasoning as
    // authorize() in src/auth.ts. Does not sign the user in; that's a
    // separate action via the existing Credentials sign-in flow.
    return Response.json(
        { data: { id: user.id, email: user.email } },
        { status: 201 }
    )
}
