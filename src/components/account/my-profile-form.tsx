'use client'

import { useState } from "react"
import { useSession } from "next-auth/react"
import { ProfileForm, type ProfileFormValues } from "./profile-form"

export function MyProfileForm({ initial }: { initial: ProfileFormValues }) {
    const { update } = useSession()
    const [values, setValues] = useState(initial)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    async function handleSave(next: ProfileFormValues) {
        setError(null)
        setSuccess(false)

        try {
            const res = await fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(next),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            const body = await res.json()
            setValues({ name: body.data.name ?? "", email: body.data.email, phone: body.data.phone })
            setSuccess(true)

            // JWT strategy caches name/email in the session token itself — this
            // is what refreshes it without requiring a sign-out/sign-in. See
            // the trigger === "update" branch in src/auth.ts's jwt callback.
            await update({ name: body.data.name, email: body.data.email })
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div className="mt-6">
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}
            {success && !error && (
                <p role="status" className="mb-3 text-sm text-primary">
                    Profile updated.
                </p>
            )}
            <ProfileForm initial={values} submitLabel="Save Changes" onSubmit={handleSave} />
        </div>
    )
}
