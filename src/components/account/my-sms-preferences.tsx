'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SmsConsentCheckbox } from "@/components/sms/sms-consent-checkbox"
import { SALON_CONTACT, formatPhone } from "@/lib/site"
import { stoppedMessage, type SmsStatus } from "@/lib/sms-consent"

// My Account's "Text Messages" section: the same opt-in box as /register,
// plus where things stand. Ticking sends a "Reply YES" text; texts start once
// the customer replies. Changing the profile phone turns texts off (the
// consent was for the old number). A number that replied STOP can only be
// turned back on by texting START, and this section says how.
export function MySmsPreferences({
    initialStatus,
    initialPhone,
}: {
    initialStatus: SmsStatus
    // The number texts go to (E.164), or null when off.
    initialPhone: string | null
}) {
    const [status, setStatus] = useState(initialStatus)
    const [phone, setPhone] = useState(initialPhone)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resent, setResent] = useState(false)

    async function save(optIn: boolean) {
        setPending(true)
        setError(null)
        setResent(false)
        try {
            const res = await fetch("/api/users/me/sms", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ optIn }),
            })
            const body = await res.json().catch(() => null)
            if (!res.ok) {
                setError(body?.error ?? "Couldn't save. Please try again.")
                return
            }
            setStatus(body.data.status)
            setPhone(body.data.smsPhone)
            return body.data.status as SmsStatus
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setPending(false)
        }
    }

    async function resend() {
        if ((await save(true)) === "waiting") setResent(true)
    }

    const number = phone ? formatPhone(phone) : "your phone"

    return (
        <section className="mt-12">
            <h2 className="mb-5 font-serif text-2xl font-extrabold text-foreground">Text Messages</h2>
            <SmsConsentCheckbox
                id="account-sms-opt-in"
                checked={status === "on" || status === "waiting"}
                onChange={save}
                disabled={pending}
            />
            <div aria-live="polite" className="mt-3 text-sm">
                {status === "on" && <p className="text-accent">{`Texts are on for ${number}.`}</p>}
                {status === "stopped" && !error && (
                    <p className="text-surface-foreground">
                        {stoppedMessage(SALON_CONTACT.smsNumber ? formatPhone(SALON_CONTACT.smsNumber) : null)}
                    </p>
                )}
                {status === "waiting" && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="text-surface-foreground">
                            {`We texted ${number}. Reply YES to start getting appointment texts.`}
                        </p>
                        <Button type="button" variant="secondary" onClick={resend} disabled={pending}>
                            Send It Again
                        </Button>
                        {resent && <p className="text-xs text-muted-foreground">Sent. It can take a minute to arrive.</p>}
                    </div>
                )}
                {error && (
                    <p role="alert" className="text-danger">
                        {error}
                    </p>
                )}
            </div>
        </section>
    )
}
