'use client'

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

// A destructive action that asks first, in place. Until clicked it's a
// quiet grey text button; clicked, it becomes
// a one-line question with the red "Yes" button and a safe way back, which
// gets focus. So the only red on a list of rows is the one being confirmed.
export function ConfirmAction({
    label,
    prompt,
    confirmLabel,
    onConfirm,
    disabled = false,
    busyLabel,
    busy = false,
    keepLabel = "Keep",
}: {
    label: string
    // Short — it sits on the row, e.g. "Deactivate Manicure?".
    prompt: string
    confirmLabel: string
    onConfirm: () => void
    disabled?: boolean
    busy?: boolean
    busyLabel?: string
    keepLabel?: string
}) {
    const [confirming, setConfirming] = useState(false)
    const keepRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (confirming) keepRef.current?.focus()
    }, [confirming])

    if (!confirming) {
        return (
            <Button variant="quiet" size="md" onClick={() => setConfirming(true)} disabled={disabled || busy}>
                {busy && busyLabel ? busyLabel : label}
            </Button>
        )
    }

    return (
        <div role="group" aria-label={prompt} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{prompt}</span>
            <Button
                variant="danger"
                size="md"
                disabled={busy}
                onClick={() => {
                    setConfirming(false)
                    onConfirm()
                }}
            >
                {confirmLabel}
            </Button>
            <Button ref={keepRef} variant="secondary" size="md" onClick={() => setConfirming(false)} disabled={busy}>
                {keepLabel}
            </Button>
        </div>
    )
}
