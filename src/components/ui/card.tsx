import { type HTMLAttributes } from "react"

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`rounded-xl border border-border bg-surface text-surface-foreground shadow-sm ${className}`}
            {...props}
        />
    )
}
