import { SITE_NAME } from "@/lib/site"

type PasswordResetEmailArgs = {
    resetUrl: string
}

// Plain functions returning strings, not a templating library — react-email
// has a documented Cloudflare Workers startup-CPU failure (pulling React +
// its component library into the bundle blows the Workers cold-start budget),
// and this project's Cloudflare adapter question is already unresolved. Not
// worth adding a second unproven variable. Revisit only if the number of
// templates grows past a handful.
export function passwordResetEmail({ resetUrl }: PasswordResetEmailArgs): {
    subject: string
    html: string
    text: string
} {
    const subject = `Reset your ${SITE_NAME} password`

    const text = [
        `We received a request to reset your ${SITE_NAME} password.`,
        ``,
        `Reset it here: ${resetUrl}`,
        ``,
        `This link expires in 15 minutes.`,
        ``,
        `If you didn't request this, you can ignore this email — your password hasn't been changed.`,
    ].join("\n")

    // Inline styles, no external images, no tables — kept deliberately
    // simple per the same reasoning as skipping react-email above.
    const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #2a2a2a;">
            <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your password</h1>
            <p style="font-size: 15px; line-height: 1.5;">
                We received a request to reset your ${SITE_NAME} password.
            </p>
            <p style="margin: 24px 0;">
                <a href="${resetUrl}" style="background: #2a2a2a; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-size: 15px; display: inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="font-size: 13px; color: #666666; line-height: 1.5;">
                This link expires in 15 minutes. If you didn't request this, you can ignore this
                email — your password hasn't been changed.
            </p>
        </div>
    `.trim()

    return { subject, html, text }
}
