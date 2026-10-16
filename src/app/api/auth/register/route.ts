import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeEmail, normalizePhone, requiredText, TEXT_LIMITS } from "@/lib/validation"
import { BCRYPT_COST, passwordError } from "@/lib/password"
import { readJsonObject } from "@/lib/request"

export async function POST(request: Request) {
    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    // Name is required so emails and the admin schedule can address the
    // customer by name (it was optional before, so older accounts may have
    // none — the profile prompt asks them to add it).
    const name = requiredText(body.name, TEXT_LIMITS.personName)
    if (name === null) {
        return Response.json(
            { error: "Your name is required" },
            { status: 400 }
        )
    }

    const email = normalizeEmail(body.email)
    if (email === null) {
        return Response.json(
            { error: "A valid email is required" },
            { status: 400 }
        )
    }

    const passwordProblem = passwordError(body.password)
    if (passwordProblem) {
        return Response.json(
            { error: passwordProblem },
            { status: 400 }
        )
    }
    const password = body.password as string

    const phone = normalizePhone(body.phone)
    if (phone === null) {
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
        data: { name, email, phone, passwordHash },
    })

    // Scrubbed response — never echo passwordHash back, same reasoning as
    // authorize() in src/auth.ts. Does not sign the user in; that's a
    // separate action via the existing Credentials sign-in flow.
    return Response.json(
        { data: { id: user.id, email: user.email } },
        { status: 201 }
    )
}
