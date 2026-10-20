'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-raised">
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
            <div>
                <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Password
                    </label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:text-primary-strong">
                        Forgot password?
                    </Link>
                </div>
                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} size="lg" className="w-full">
                {pending ? "Signing in..." : "Sign In"}
            </Button>
        </form>
    )
}
