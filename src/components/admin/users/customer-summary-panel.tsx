import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/format"
import { isNoShowFlagged, noShowLabel, type CustomerSummary } from "@/lib/customer-summary"

function formatDay(date: Date | null): string {
    return date
        ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
        : "—"
}

// The admin customer page's at-a-glance numbers (FEATURE_GAPS.md Gap 28),
// so "what does she usually have, and does she show up" doesn't take
// reading the whole history.
export function CustomerSummaryPanel({ summary }: { summary: CustomerSummary }) {
    const stats: [label: string, value: string][] = [
        ["Visits", String(summary.visits)],
        ["Total spent", formatPrice(summary.spentCents)],
        ["Average visit", summary.averageCents === null ? "—" : formatPrice(summary.averageCents)],
        ["Last visit", formatDay(summary.lastVisit)],
        ["Next booking", formatDay(summary.nextVisit)],
        ["Usual artist", summary.usualArtist ?? "—"],
        ["No-shows", summary.noShowRate === null ? String(summary.noShows) : `${summary.noShows} (${Math.round(summary.noShowRate * 100)}%)`],
        ["Cancellations", String(summary.cancellations)],
    ]

    return (
        <section aria-labelledby="customer-summary-heading" className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
                <h3 id="customer-summary-heading" className="text-base font-semibold text-foreground">
                    Summary
                </h3>
                {isNoShowFlagged(summary.noShows) && (
                    <Badge tone="danger">{`${noShowLabel(summary.noShows)} — call ahead to confirm`}</Badge>
                )}
            </div>

            {/* Separate tinted tiles: visits and money in blue, dates and the
                usual artist in gold, no-shows and cancellations in lacquer. */}
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map(([label, value], i) => (
                    <div
                        key={label}
                        className={`rounded-lg border border-line border-l-4 p-3 shadow-sm ${
                            i < 3 ? "border-l-accent bg-accent/5" : i < 6 ? "border-l-primary bg-primary/10" : "border-l-lacquer bg-lacquer/5"
                        }`}
                    >
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 font-semibold text-surface-foreground">{value}</dd>
                    </div>
                ))}
            </dl>

            {summary.topServices.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                    {`Usually books: ${summary.topServices.join(", ")}`}
                </p>
            )}
        </section>
    )
}
