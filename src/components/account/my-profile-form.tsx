'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ProfileForm, type ProfileFormValues } from "./profile-form"

export function MyProfileForm({
    initial,
    returnTo = null,
}: {
    initial: ProfileFormValues
    // Where to go after a successful save (e.g. back to /book when the
    // booking wizard sent them here to add a name/phone). Already validated
    // as a same-site path by the page.
    returnTo?: string | null
}) {
    const router = useRouter()
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

            // Re-runs the jwt callback in src/auth.ts, which re-reads the
            // user from the database — refreshing the cached name/email and
            // clearing profileIncomplete (and with it the profile banner)
            // without a sign-out/sign-in. The values sent here are ignored
            // by design; the database is the source of truth.
            await update({})

            if (returnTo) {
                router.push(returnTo)
            }
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div>
            <h2 className="mb-5 border-b-2 border-foreground pb-3 font-serif text-xl font-bold text-foreground">
                Profile Details
            </h2>
            {returnTo && (
                <p role="status" className="mb-4 rounded-sm border border-accent bg-surface p-4 text-sm text-surface-foreground">
                    Add your name and phone number below, then save — you&apos;ll go straight back to your booking.
                </p>
            )}
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}
            {success && !error && (
                <p role="status" className="mb-3 text-sm text-accent">
                    Profile updated.
                </p>
            )}
            <ProfileForm
                initial={values}
                submitLabel={returnTo ? "Save and Continue Booking" : "Save Changes"}
                onSubmit={handleSave}
            />
        </div>
    )
}
