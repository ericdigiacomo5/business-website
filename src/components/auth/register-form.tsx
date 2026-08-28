'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function RegisterForm() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        })

        setPending(false)

        if (!response.ok) {
            const body = await response.json().catch(() => null)
            setError(body?.error ?? "Something went wrong. Please try again.")
            return
        }

        router.push("/login?registered=1")
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    Password
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
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Creating account..." : "Create Account"}
            </Button>
        </form>
    )
}
