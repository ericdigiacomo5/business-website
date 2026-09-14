import { type HTMLAttributes } from "react"

type Tone = "primary" | "accent" | "muted" | "danger" | "success"

const tones: Record<Tone, string> = {
    primary: "bg-primary text-primary-foreground",
    accent: "bg-accent text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
    danger: "bg-danger text-danger-foreground",
    success: "bg-success text-success-foreground",
}

export function Badge({
    tone = "muted",
    className = "",
    ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
    return (
        <span
            className={`inline-flex items-center rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide ${tones[tone]} ${className}`}
            {...props}
        />
    )
}
