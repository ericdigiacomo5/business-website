import { Skeleton } from "@/components/ui/skeleton"
import { Control, FilterRowSkeleton, LoadingRegion, TextLine } from "@/components/ui/page-skeletons"

// The schedule (/admin) while it loads: filters, the month calendar beside
// the grid on desktop ("Jump to a date" on phones), the Day/Week toggle,
// the date bar, the legend and an empty grid — laid out exactly like
// src/app/admin/page.tsx. Every other admin page has its own loading.tsx.
//
// Deliberately only under /admin and /appointments, not at the root: a
// loading state makes the response stream, which fixes its HTTP status at
// 200, so a root one would turn public 404s (e.g. an unknown /artists/[id])
// into "soft 404s". Admin and account pages aren't indexed, so that cost
// doesn't apply here.
const GRID_ROWS = 16

export default function AdminScheduleLoading() {
    return (
        <LoadingRegion label="Loading the schedule…">
            <FilterRowSkeleton fields={["w-32", "w-28"]} button="w-16" />

            <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
                {/* Month calendar (desktop). */}
                <div className="hidden rounded-lg border border-line bg-surface shadow-sm p-3 lg:mt-4 lg:block">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-8" />
                        <TextLine width="w-28" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-0.5">
                        {Array.from({ length: 7 * 6 }, (_, i) => (
                            <div key={i} className="flex h-9 items-center justify-center">
                                <Skeleton className={i < 7 ? "h-2.5 w-4" : "h-3 w-4"} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="min-w-0">
                    {/* "Jump to a date" (phones). */}
                    <div className="mt-4 flex h-11 items-center lg:hidden">
                        <Skeleton className="h-3 w-24" />
                    </div>
                    {/* Day / Week toggle and the date bar. */}
                    <Skeleton className="mt-4 h-12 w-44" />
                    <div className="mt-4 flex items-center justify-center gap-4 rounded-lg border border-line bg-surface shadow-sm p-3">
                        <Control width="w-11" />
                        <TextLine width="w-28" />
                        <Control width="w-11" />
                    </div>

                    <div className="mt-6">
                        <TextLine width="w-64" className="mb-3" />
                        <TextLine size="xs" width="w-72" className="mb-3" />
                        <div className="grid grid-cols-[64px_repeat(2,minmax(112px,1fr))]">
                            {/* Header row, then the time rows. */}
                            <div className="h-16 border-b border-border" />
                            {[0, 1].map((col) => (
                                <div key={col} className="flex h-16 flex-col items-center justify-center gap-1.5 border-b border-l border-border bg-muted/40">
                                    <Skeleton className="h-3 w-20" />
                                    <Skeleton className="h-2.5 w-10" />
                                </div>
                            ))}
                            {Array.from({ length: GRID_ROWS }, (_, row) => (
                                <div key={row} className="contents">
                                    <div className="flex items-start justify-end pr-2" style={{ height: "var(--schedule-row-height)" }}>
                                        {row % 2 === 0 && <Skeleton className="mt-1 h-2 w-8" />}
                                    </div>
                                    {[0, 1].map((col) => (
                                        <div key={col} className="border-b border-l border-border" style={{ height: "var(--schedule-row-height)" }} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </LoadingRegion>
    )
}
