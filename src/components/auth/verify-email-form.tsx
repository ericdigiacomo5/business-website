'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { removeTokenFromAddressBar } from "@/lib/url-token"

// A button, not an automatic request on page load: email security scanners
// open links before people do, and a GET that used the token up would leave
// the real click with "this link has expired".
export function VerifyEmailForm({ token }: { token: string }) {
    const { status, update } = useSession()
    useEffect(removeTokenFromAddressBar, [])
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [confirmed, setConfirmed] = useState<{ email: string; changed: boolean } | null>(null)

    async function handleConfirm() {
        setError(null)
        setPending(true)

        try {
            const response = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const body = await response.json().catch(() => null)

            if (!response.ok) {
                setError(body?.error ?? "Something went wrong. Please try again.")
                return
            }

            setConfirmed(body.data)
            // Signed in on this device: refresh the session so the banner
            // clears and booking unlocks without signing in again.
            if (status === "authenticated") await update({})
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    if (confirmed) {
        return (
            <div role="status" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-raised text-center">
                <p className="text-sm text-foreground">
                    {confirmed.changed
                        ? `Your account's email is now ${confirmed.email}.`
                        : `Thanks — ${confirmed.email} is confirmed.`}
                </p>
                <Link href={status === "authenticated" ? "/book" : "/login"} className="text-sm font-semibold text-accent hover:text-primary-strong">
                    {status === "authenticated" ? "Book an appointment" : "Sign in"}
                </Link>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-raised">
            <p className="text-sm text-surface-foreground">Confirm that this email address is yours.</p>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="button" onClick={handleConfirm} disabled={pending} size="lg" className="w-full">
                {pending ? "Confirming..." : "Confirm Email"}
            </Button>
        </div>
    )
}
