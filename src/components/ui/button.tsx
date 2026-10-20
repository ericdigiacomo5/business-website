import { type ButtonHTMLAttributes, forwardRef } from "react"

type Variant = "primary" | "secondary" | "gold" | "inverse" | "danger" | "ghost" | "quiet"
type Size = "md" | "lg"

const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold uppercase tracking-wide transition cursor-pointer " +
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"

const variants: Record<Variant, string> = {
    // Header/nav "Book Now" — the blue CTA.
    primary: "bg-accent text-accent-foreground border border-foreground/80 shadow-sm hover:bg-accent/90 hover:shadow-md",
    // Soft-filled cream with a light edge, so it reads as a button and not
    // as one of the navy-outlined form fields beside it.
    secondary:
        "bg-cream text-surface-foreground border border-foreground/25 shadow-sm hover:bg-cream-hover hover:border-foreground/40",
    // The main call to action — metallic gold with a sheen (globals.css).
    gold: "btn-sheen text-primary-foreground border border-foreground/80 shadow-md hover:shadow-lg",
    // Closing CTA band — the dark navy button against the gold band.
    inverse: "bg-foreground text-background border border-foreground shadow-md hover:bg-foreground/90 hover:shadow-lg",
    danger: "bg-danger text-danger-foreground border border-foreground/80 shadow-sm hover:bg-danger/90",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    // A destructive action before it's confirmed (ConfirmAction): plain grey
    // text that only turns red on hover — the red button is the "Yes" step.
    quiet: "bg-transparent text-muted-foreground hover:bg-danger/5 hover:text-danger",
}

// h-11 = 44px, meeting this project's minimum tap-target requirement.
const sizes: Record<Size, string> = {
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-6 text-base",
}

export function buttonVariants({
    variant = "primary",
    size = "md",
    className = "",
}: {
    variant?: Variant
    size?: Size
    className?: string
} = {}) {
    return [base, variants[variant], sizes[size], className].join(" ")
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "primary", size = "md", className = "", ...props },
    ref
) {
    return <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
})
