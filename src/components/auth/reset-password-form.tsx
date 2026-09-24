'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function ResetPasswordForm({ token }: { token: string }) {
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError("Passwords don't match.")
            return
        }

        setPending(true)

        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
        })

        setPending(false)

        if (!response.ok) {
            const body = await response.json().catch(() => null)
            setError(body?.error ?? "Something went wrong. Please try again.")
            return
        }

        router.push("/login?reset=1")
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-foreground bg-surface p-8">
            <div>
                <label htmlFor="password" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    New Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
                <label htmlFor="confirmPassword" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Confirm New Password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} size="lg" className="w-full">
                {pending ? "Updating..." : "Update Password"}
            </Button>
        </form>
    )
}
