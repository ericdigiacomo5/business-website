import { type ButtonHTMLAttributes, forwardRef } from "react"

type Variant = "primary" | "secondary" | "gold" | "inverse" | "danger" | "ghost"
type Size = "md" | "lg"

const base =
    "inline-flex items-center justify-center gap-2 rounded-sm font-semibold uppercase tracking-wide transition-colors " +
    "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

const variants: Record<Variant, string> = {
    // Header/nav "Book Now" — matches the mockup's blue CTA.
    primary: "bg-accent text-accent-foreground border border-foreground hover:bg-accent/90",
    secondary: "bg-surface text-surface-foreground border border-foreground hover:bg-muted",
    // Hero "Book Now" — the mockup's gold CTA against the dark hero background.
    gold: "bg-primary text-primary-foreground border border-foreground hover:bg-primary/90",
    // Closing CTA band — the mockup's dark navy button against the gold band background.
    inverse: "bg-foreground text-background border border-foreground hover:bg-foreground/90",
    danger: "bg-danger text-danger-foreground border border-foreground hover:bg-danger/90",
    ghost: "bg-transparent text-foreground hover:bg-muted",
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
