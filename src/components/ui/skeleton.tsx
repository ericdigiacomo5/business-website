// Placeholder blocks shaped like the content that's loading (FEATURE_GAPS.md
// U8) — the page feels faster than a centered spinner at the same speed.
// Decorative: the loading.tsx that uses them carries the role="status" and
// the screen-reader text.
export function Skeleton({ className = "" }: { className?: string }) {
    return <div aria-hidden className={`skeleton rounded-sm bg-muted ${className}`} />
}
