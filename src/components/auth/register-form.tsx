'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SmsConsentCheckbox } from "@/components/sms/sms-consent-checkbox"
import { TEXT_LIMITS } from "@/lib/validation"

export function RegisterForm() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")
    // Never pre-checked (carrier rule).
    const [smsOptIn, setSmsOptIn] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setPending(true)

        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, phone, password, smsOptIn }),
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-raised">
            <div>
                <label htmlFor="name" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Name
                </label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={TEXT_LIMITS.personName}
                    autoComplete="name"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>
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
                <label htmlFor="phone" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Phone
                </label>
                <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    maxLength={TEXT_LIMITS.phone}
                    autoComplete="tel"
                    placeholder="(631) 555-0143"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>
            <div>
                <label htmlFor="password" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <SmsConsentCheckbox id="sms-opt-in" checked={smsOptIn} onChange={setSmsOptIn} />
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
            <Button type="submit" disabled={pending} size="lg" className="w-full">
                {pending ? "Creating account..." : "Create Account"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
                {"By creating an account you agree to our "}
                <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                    Terms
                </Link>
                {" and "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                    Privacy Policy
                </Link>
                .
            </p>
        </form>
    )
}
