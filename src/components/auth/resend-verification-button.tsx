'use client'

import { useState } from "react"
import { useSession } from "next-auth/react"

// "Send the confirmation link again" for a signed-in user whose email isn't
// confirmed. Also re-checks the session first, in case they've already
// clicked the link on another device. Used by the site-wide banner and the
// booking review step.
export function ResendVerificationButton({ className }: { className?: string }) {
    const { update } = useSession()
    const [message, setMessage] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleClick() {
        setPending(true)
        setMessage(null)
        try {
            const response = await fetch("/api/auth/resend-verification", { method: "POST" })
            const body = await response.json().catch(() => null)
            if (response.ok && body?.data?.alreadyVerified) {
                // Confirmed elsewhere — refreshing the session clears the
                // banner and unlocks booking.
                await update({})
                return
            }
            setMessage(response.ok ? `Sent — check ${body?.data?.sentTo ?? "your inbox"}.` : (body?.error ?? "Couldn't send. Please try again."))
        } catch {
            setMessage("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    return (
        <span className="inline-flex flex-wrap items-center gap-x-3">
            <button
                type="button"
                onClick={handleClick}
                disabled={pending}
                className={className ?? "inline-flex h-11 items-center font-semibold text-accent underline underline-offset-2 disabled:opacity-60"}
            >
                {pending ? "Sending..." : "Resend link"}
            </button>
            {message && <span role="status">{message}</span>}
        </span>
    )
}
