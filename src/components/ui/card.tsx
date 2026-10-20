import { type HTMLAttributes } from "react"

// A raised public card: near-white paper on the cream page, with a soft
// warm shadow and a hairline edge instead of a navy outline.
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`rounded-xl border border-line bg-surface text-surface-foreground shadow-card ${className}`}
            {...props}
        />
    )
}
