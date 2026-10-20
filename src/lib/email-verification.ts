// Email verification — server-only (imports prisma). Proves the person
// signed in controls an address before the app treats it as theirs:
//   - at registration (the account's own address), and
//   - when a signed-in user changes their address (the new one, which only
//     replaces User.email once the link is used — see POST /api/auth/verify-email).
// Until verified, a self-registered account can't book online and gets no
// booking emails (appointment-emails.ts), so a stranger's address entered at
// signup can't be used to send the salon's emails to them.

import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateResetToken } from "@/lib/password-reset-token"
import { sendEmail } from "@/lib/email"
import { emailVerificationEmail } from "@/lib/email-templates"

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours: people check email later
const RESEND_COOLDOWN_MS = 60 * 1000 // same per-account throttle as forgot-password

// Issues a token for `email` and schedules the email with after(), so it's
// sent once the response is out. Returns false (and sends nothing) if a link
// was already sent to this account in the last minute — without that, the
// resend button and the email-change form would be a free email-bombing relay.
export async function issueEmailVerification(
    userId: string,
    email: string,
    purpose: "signup" | "change"
): Promise<boolean> {
    const recent = await prisma.emailVerificationToken.findFirst({
        where: { userId, usedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
        select: { id: true },
    })
    if (recent) return false

    // Same 256-bit token, stored only as its SHA-256, as a password reset.
    const { token, tokenHash } = await generateResetToken()
    await prisma.emailVerificationToken.create({
        data: { userId, email, tokenHash, expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
    })

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`
    after(() => sendEmail({ to: email, ...emailVerificationEmail({ verifyUrl, purpose }) }))
    return true
}
