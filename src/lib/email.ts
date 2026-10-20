import { errorMessage, reportError } from "@/lib/report-error"

const RESEND_API_URL = "https://api.resend.com/emails"

type SendEmailArgs = {
    to: string
    subject: string
    html: string
    text: string
}

// Provider-agnostic on purpose: every caller only ever sees this function, so
// swapping Resend for Postmark/SES later (e.g. if shared-IP deliverability
// becomes a problem) is a one-function change, not a project-wide one.
//
// Never throws — a failed send should never take down the operation that
// triggered it (a booking must still succeed even if its confirmation email
// bounces). Callers that need to know whether the send worked can check the
// returned `ok` flag; nobody currently needs to.
export async function sendEmail({ to, subject, html, text }: SendEmailArgs): Promise<{ ok: boolean }> {
    const apiKey = process.env.RESEND_API_KEY

    // Dev driver: no API key configured means no send attempt, ever — this
    // is what makes the whole email-dependent feature set (password reset
    // now, booking confirmations later) testable locally with zero setup
    // and zero risk of accidentally emailing a real address in dev.
    //
    // Only outside production, though. In a production build a missing key
    // is a misconfiguration, not a dev setup — and printing the body there
    // would write live password-reset and verification links into the host's
    // logs (Workers Logs, `wrangler tail`, any log export), readable by anyone
    // with dashboard access. So production logs only that the key is missing
    // and reports the send as failed.
    if (!apiKey) {
        if (process.env.NODE_ENV === "production") {
            await reportError({ event: "email_failed", message: "RESEND_API_KEY is not set — email not sent" })
            return { ok: false }
        }
        console.log("[email:dev] would send:", { to, subject, text })
        return { ok: true }
    }

    try {
        const res = await fetch(RESEND_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM,
                to,
                subject,
                html,
                text,
            }),
        })

        // The report isn't given the recipient or subject (the subject can
        // name the customer's booking); Resend's own error text is kept,
        // truncated, because it's what says what went wrong.
        if (!res.ok) {
            await reportError({ event: "email_failed", message: `Resend returned ${res.status}: ${await res.text()}` })
            return { ok: false }
        }

        return { ok: true }
    } catch (error) {
        await reportError({ event: "email_failed", message: `Resend request threw: ${errorMessage(error)}` })
        return { ok: false }
    }
}
