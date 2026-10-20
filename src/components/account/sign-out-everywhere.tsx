'use client'

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"

// "Sign out of all devices" — for a lost phone, or a shared computer the
// customer forgot to sign out of. Every session ends on its next request,
// this one included, so it finishes by signing out here too.
export function SignOutEverywhere() {
    const [confirming, setConfirming] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleConfirm() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch("/api/users/me/sign-out-everywhere", { method: "POST" })
            if (!response.ok) {
                setError("Couldn't sign out other devices. Please try again.")
                setPending(false)
                return
            }
            await signOut({ redirectTo: "/login" })
        } catch {
            setError("Network error. Please try again.")
            setPending(false)
        }
    }

    return (
        <section className="mt-12">
            <h2 className="mb-5 font-serif text-2xl font-extrabold text-foreground">
                Security
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
                Signed in somewhere you shouldn&apos;t be, like a lost phone? This signs you out everywhere,
                including here.
            </p>
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}
            {confirming ? (
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="danger" onClick={handleConfirm} disabled={pending}>
                        {pending ? "Signing out..." : "Yes, Sign Out Everywhere"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
                    Sign Out of All Devices
                </Button>
            )}
        </section>
    )
}
