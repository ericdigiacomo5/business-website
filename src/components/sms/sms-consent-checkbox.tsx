'use client'

import Link from "next/link"
import { SMS_CONSENT_DETAILS, SMS_CONSENT_LABEL } from "@/lib/sms-consent"

// The texting opt-in, worded for carrier review (src/lib/sms-consent.ts).
// Always starts unchecked: the parent's state must default to false, and
// nothing ever ticks it for the customer. Used on /register (public, so the
// 10DLC reviewers can see it) and My Account.
export function SmsConsentCheckbox({
    id,
    checked,
    onChange,
    disabled = false,
}: {
    id: string
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
}) {
    return (
        <div className="flex gap-3">
            {/* The label wraps a 44px tap area around the box. */}
            <label htmlFor={id} className="-m-2.5 flex h-11 w-11 flex-none cursor-pointer items-center justify-center">
                <input
                    id={id}
                    name="smsOptIn"
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                    aria-describedby={`${id}-details`}
                    className="h-5 w-5 cursor-pointer accent-[var(--primary)]"
                />
            </label>
            <div className="text-sm">
                <label htmlFor={id} className="cursor-pointer font-medium text-foreground">
                    {SMS_CONSENT_LABEL}
                </label>
                <p id={`${id}-details`} className="mt-1 text-xs text-muted-foreground">
                    {`${SMS_CONSENT_DETAILS} See our `}
                    <Link href="/terms#sms" className="underline underline-offset-2 hover:text-foreground">
                        Terms
                    </Link>
                    {" and "}
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </div>
        </div>
    )
}
