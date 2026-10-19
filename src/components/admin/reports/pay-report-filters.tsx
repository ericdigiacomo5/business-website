import Link from "next/link"
import { Button } from "@/components/ui/button"
import { toLocalDateKey } from "@/lib/format"
import type { ReportPreset } from "@/lib/pay-report"

export type VisitsParam = "show" | "hide" | ""

function reportHref(from: Date, to: Date, artistId: string, visits: VisitsParam): string {
    const query = new URLSearchParams({ from: toLocalDateKey(from), to: toLocalDateKey(to) })
    if (artistId) query.set("artistId", artistId)
    if (visits) query.set("visits", visits)
    return `/admin/reports/pay?${query.toString()}`
}

const FIELD = "mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"

// No 'use client' needed: a plain GET form, so the URL (?from=&to=&artistId=)
// is always the source of truth — a report can be reloaded, bookmarked or
// shared as a link. Same approach as the schedule's DatePicker.
export function PayReportFilters({
    from,
    to,
    artistId,
    visits,
    artists,
    presets,
}: {
    from: string
    to: string
    artistId: string
    visits: VisitsParam
    artists: { id: string; name: string; active: boolean }[]
    presets: ReportPreset[]
}) {
    return (
        <div className="rounded-sm border border-border bg-surface p-4 print:hidden">
            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_1fr_auto] lg:items-end">
                <div>
                    <label htmlFor="report-from" className="block text-xs font-medium text-muted-foreground">
                        From
                    </label>
                    <input id="report-from" type="date" name="from" required defaultValue={from} className={FIELD} />
                </div>
                <div>
                    <label htmlFor="report-to" className="block text-xs font-medium text-muted-foreground">
                        To
                    </label>
                    <input id="report-to" type="date" name="to" required defaultValue={to} className={FIELD} />
                </div>
                <div>
                    <label htmlFor="report-artist" className="block text-xs font-medium text-muted-foreground">
                        Artist
                    </label>
                    <select id="report-artist" name="artistId" defaultValue={artistId} className={FIELD}>
                        <option value="">All artists</option>
                        {artists.map((artist) => (
                            <option key={artist.id} value={artist.id}>
                                {artist.active ? artist.name : `${artist.name} (inactive)`}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="report-visits" className="block text-xs font-medium text-muted-foreground">
                        Itemized visits
                    </label>
                    <select id="report-visits" name="visits" defaultValue={visits} className={FIELD}>
                        <option value="">Default</option>
                        <option value="show">Show</option>
                        <option value="hide">Hide</option>
                    </select>
                </div>
                <Button type="submit" size="md" className="sm:col-span-2 lg:col-span-1">
                    Show Report
                </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((preset) => (
                    <Link
                        key={preset.label}
                        href={reportHref(preset.from, preset.to, artistId, visits)}
                        className="inline-flex h-11 items-center rounded-sm border border-border/40 px-3 text-sm text-foreground hover:bg-muted"
                    >
                        {preset.label}
                    </Link>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                Itemized visits are shown by default for one artist and hidden for all artists.
            </p>
        </div>
    )
}
