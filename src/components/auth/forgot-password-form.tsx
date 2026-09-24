'use client'

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function ForgotPasswordForm() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        })

        setPending(false)

        // The API returns the same 200 whether or not an account exists — by
        // design, so this can never be an email-enumeration oracle. Only a
        // genuine request problem (bad JSON, missing field) surfaces an
        // error; every other outcome shows the identical confirmation.
        if (!response.ok) {
            const body = await response.json().catch(() => null)
            setError(body?.error ?? "Something went wrong. Please try again.")
            return
        }

        setSubmitted(true)
    }

    if (submitted) {
        return (
            <div className="flex flex-col gap-4 border border-foreground bg-surface p-8 text-center">
                <p className="text-sm text-foreground">
                    If an account exists for that email, we&apos;ve sent a password reset link.
                    It expires in 15 minutes.
                </p>
                <Link href="/login" className="text-sm font-semibold text-accent hover:text-primary">
                    Back to sign in
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-foreground bg-surface p-8">
            <div>
                <label htmlFor="email" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} size="lg" className="w-full">
                {pending ? "Sending..." : "Send Reset Link"}
            </Button>
        </form>
    )
}
