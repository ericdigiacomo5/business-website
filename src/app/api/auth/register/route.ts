import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

// Same cost factor as DUMMY_PASSWORD_HASH in src/auth.ts — keep these in sync,
// since a mismatch wouldn't break anything functionally, but would make the
// timing-safety comment in auth.ts inaccurate.
const BCRYPT_COST = 10

// Deliberately not RFC 5322-exhaustive — just enough to reject obvious
// garbage (no "@", no domain, whitespace). Proving the address is real and
// actually belongs to the registrant is a different problem, solved by
// send-a-confirmation-link verification (User.emailVerified already exists in
// the schema for this), not by stricter format matching here.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254 // practical upper bound per RFC 5321

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

    const { email, password } = body as Record<string, unknown>

    if (
        !email ||
        typeof email !== "string" ||
        email.length > EMAIL_MAX_LENGTH ||
        !EMAIL_PATTERN.test(email)
    ) {
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

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
        return Response.json(
            { error: "An account with that email already exists" },
            { status: 409 }
        )
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    const user = await prisma.user.create({
        data: { email, passwordHash },
    })

    // Scrubbed response — never echo passwordHash back, same reasoning as
    // authorize() in src/auth.ts. Does not sign the user in; that's a
    // separate action via the existing Credentials sign-in flow.
    return Response.json(
        { data: { id: user.id, email: user.email } },
        { status: 201 }
    )
}
