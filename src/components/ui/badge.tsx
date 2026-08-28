import { type HTMLAttributes } from "react"

type Tone = "primary" | "accent" | "muted" | "danger" | "success"

const tones: Record<Tone, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
    danger: "bg-danger/10 text-danger",
    success: "bg-success/10 text-success",
}

export function Badge({
    tone = "muted",
    className = "",
    ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
            {...props}
        />
    )
}
