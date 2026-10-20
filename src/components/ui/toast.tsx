'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { CheckCircle2, X } from "lucide-react"

// One shared "it worked" message (FEATURE_GAPS.md U4). Success only:
// errors stay inline next to whatever caused them, where they can be fixed.
//
// The live region is always in the page (empty when nothing is showing), so
// screen readers announce each new message — a region inserted together with
// its text is often missed.

type ToastContextValue = (message: string) => void

const ToastContext = createContext<ToastContextValue>(() => {})

const VISIBLE_MS = 4500

export function useToast(): ToastContextValue {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    // `id` changes on every toast so the same text twice still re-announces
    // and restarts the timer.
    const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
    const nextId = useRef(0)

    const show = useCallback((message: string) => {
        nextId.current += 1
        setToast({ id: nextId.current, message })
    }, [])

    useEffect(() => {
        if (!toast) return
        const timeout = setTimeout(() => setToast(null), VISIBLE_MS)
        return () => clearTimeout(timeout)
    }, [toast])

    return (
        <ToastContext.Provider value={show}>
            {children}
            <div
                role="status"
                aria-live="polite"
                // Top of the screen, under the sticky header: the booking
                // wizard and admin sheets own the bottom edge.
                className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4 print:hidden"
            >
                {toast && (
                    <div
                        key={toast.id}
                        className="toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-sm border-l-4 border-primary bg-foreground py-3 pr-2 pl-4 text-sm text-background shadow-lg"
                    >
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                        <span className="flex-1">{toast.message}</span>
                        <button
                            type="button"
                            onClick={() => setToast(null)}
                            aria-label="Dismiss"
                            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-on-dark-muted hover:text-background"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </ToastContext.Provider>
    )
}
