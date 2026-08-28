'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        })

        setPending(false)

        if (!result || result.error) {
            setError("Incorrect email or password.")
            return
        }

        router.push(callbackUrl)
        router.refresh()
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
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-foreground"
                />
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Signing in..." : "Sign In"}
            </Button>
        </form>
    )
}
