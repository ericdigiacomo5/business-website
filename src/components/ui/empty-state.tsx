import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

// "Nothing here yet" with a reason and the obvious next step (FEATURE_GAPS.md
// U8), instead of a lone grey line.
export function EmptyState({
    icon: Icon,
    title,
    children,
    action,
    className = "",
}: {
    icon: LucideIcon
    title: string
    // One sentence in the salon's voice.
    children?: ReactNode
    // Usually a link styled as a button.
    action?: ReactNode
    className?: string
}) {
    return (
        <div
            className={`flex flex-col items-center rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-card ${className}`}
        >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lacquer/10 text-lacquer">
                <Icon className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 font-serif text-lg font-bold text-foreground">{title}</p>
            {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    )
}
