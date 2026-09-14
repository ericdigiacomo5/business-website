import { type HTMLAttributes } from "react"

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`rounded-none border border-foreground bg-surface text-surface-foreground ${className}`}
            {...props}
        />
    )
}
