import type { ReactNode } from "react"
import { DecoDivider } from "@/components/ui/deco"

// Shared layout for /privacy and /terms: the About page's type styles, one
// <section> per heading (with an id, so the opt-in box can link to #sms).

export function PolicyPage({
    title,
    lastUpdated,
    children,
}: {
    title: string
    // "October 22, 2026" — shown once the text is final; null while drafting.
    lastUpdated: string | null
    children: ReactNode
}) {
    return (
        <article className="mx-auto max-w-3xl px-4 py-14">
            <h1 className="font-serif text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">{title}</h1>
            <DecoDivider className="mt-3 text-primary" />
            {lastUpdated && <p className="mt-4 text-sm text-muted-foreground">{`Last updated ${lastUpdated}`}</p>}
            <div className="mt-8 space-y-10 text-base leading-relaxed text-body">{children}</div>
        </article>
    )
}

export function PolicySection({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24">
            <h2 className="font-serif text-2xl font-extrabold text-foreground">{heading}</h2>
            <div className="mt-3 space-y-3">{children}</div>
        </section>
    )
}

// Space for text that hasn't been written yet. Deliberately loud, so it
// can't go live unnoticed: the deploy runbook's smoke test checks these
// pages for "To be written".
export function PolicyPlaceholder({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-md border-2 border-dashed border-line bg-cream p-4 text-sm text-muted-foreground">
            <p className="font-semibold uppercase tracking-wide">To be written</p>
            <div className="mt-1">{children}</div>
        </div>
    )
}
