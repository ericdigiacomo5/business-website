import Link from "next/link"
import { redirect } from "next/navigation"
import { PayReportFilters, type VisitsParam } from "@/components/admin/reports/pay-report-filters"
import { PaySheet } from "@/components/admin/reports/pay-sheet"
import { PrintButton } from "@/components/admin/reports/print-button"
import { SalesTable } from "@/components/admin/reports/sales-table"
import { formatPrice, parseLocalDate, toLocalDateKey } from "@/lib/format"
import { loadPayReportArtists, loadPayReportVisits } from "@/lib/pay-report-data"
import {
    DEFAULT_REPORT_DAYS,
    formatDateRange,
    formatShare,
    paySummary,
    rangeError,
    reportPresets,
    salesByService,
    visitFigures,
    type VisitFigures,
} from "@/lib/pay-report"
import { addDays } from "@/lib/recurring"
import { endOfDay, startOfDay } from "@/lib/schedule-grid"

function money(cents: number | null): string {
    return cents === null ? "Unknown" : formatPrice(cents)
}

// Artist pay report (PLAN_ARTIST_PAY_REPORT.md, steps 1-3): for any date
// range, one artist's sheet or every artist's, each organized by service
// category and then service, printable one artist per page. Calculated
// live from completed visits. Admin-only via admin/layout.tsx.
export default async function PayReportPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; artistId?: string; visits?: string }>
}) {
    const params = await searchParams
    const today = startOfDay(new Date())
    const artists = await loadPayReportArtists()

    // Missing or malformed dates (or an unknown artist) redirect to a
    // canonical URL, so the URL always says exactly what's shown — same
    // pattern as the schedule's ?dateString=.
    const from = params.from ? parseLocalDate(params.from) : null
    const to = params.to ? parseLocalDate(params.to) : null
    const artistKnown = !params.artistId || artists.some((artist) => artist.id === params.artistId)
    const visits: VisitsParam = params.visits === "show" || params.visits === "hide" ? params.visits : ""
    if (!from || !to || !artistKnown) {
        const query = new URLSearchParams({
            from: toLocalDateKey(from ?? addDays(today, -(DEFAULT_REPORT_DAYS - 1))),
            to: toLocalDateKey(to ?? today),
        })
        if (params.artistId && artistKnown) query.set("artistId", params.artistId)
        if (visits) query.set("visits", visits)
        redirect(`/admin/reports/pay?${query.toString()}`)
    }

    const artistId = params.artistId || null
    const showVisits = visits === "show" || (visits === "" && artistId !== null)
    const error = rangeError(from, to)
    const periodLabel = formatDateRange(from, to)
    const generatedAt = new Date()

    const figures = error
        ? []
        : (await loadPayReportVisits({ from: startOfDay(from), to: endOfDay(to), artistId })).map(visitFigures)

    // One sheet per artist with visits, in the artist list's order.
    const sheets = artists
        .filter((artist) => !artistId || artist.id === artistId)
        .map((artist) => ({ artist, figures: figures.filter((row) => row.visit.artistId === artist.id) }))
    const sheetsWithVisits = sheets.filter((sheet) => sheet.figures.length > 0)
    const idleArtists = sheets.filter((sheet) => sheet.figures.length === 0 && sheet.artist.active)

    return (
        <div className="flex flex-col gap-6">
            <div className="print:hidden">
                <h2 className="text-lg font-semibold text-foreground">Pay Report</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Completed visits in the dates chosen, by the day they took place. Set commission rates on
                    the{" "}
                    <Link href="/admin/artists" className="underline">
                        Artists
                    </Link>{" "}
                    page and service fees on the{" "}
                    <Link href="/admin/services" className="underline">
                        Services
                    </Link>{" "}
                    page.
                </p>
            </div>

            <PayReportFilters
                from={toLocalDateKey(from)}
                to={toLocalDateKey(to)}
                artistId={artistId ?? ""}
                visits={visits}
                artists={artists}
                presets={reportPresets(today)}
            />

            {error ? (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <p className="text-sm font-medium text-foreground">
                            {`${periodLabel} · ${artistId ? (sheets[0]?.artist.name ?? "") : "All artists"}`}
                        </p>
                        {sheetsWithVisits.length > 0 && (
                            <PrintButton
                                label={sheetsWithVisits.length > 1 ? `Print ${sheetsWithVisits.length} Sheets` : "Print"}
                            />
                        )}
                    </div>

                    {!artistId && figures.length > 0 && <SalonTotals figures={figures} sheets={sheetsWithVisits} periodLabel={periodLabel} />}

                    {sheetsWithVisits.length === 0 ? (
                        <p className="rounded-sm border border-border bg-surface p-6 text-center text-muted-foreground">
                            {`No completed visits ${artistId ? `for ${sheets[0]?.artist.name ?? "this artist"} ` : ""}in ${periodLabel}.`}
                        </p>
                    ) : (
                        sheetsWithVisits.map((sheet) => (
                            <PaySheet
                                key={sheet.artist.id}
                                artistId={sheet.artist.id}
                                artistName={sheet.artist.name}
                                periodLabel={periodLabel}
                                figures={sheet.figures}
                                showVisits={showVisits}
                                generatedAt={generatedAt}
                            />
                        ))
                    )}

                    {!artistId && sheetsWithVisits.length > 0 && idleArtists.length > 0 && (
                        <p className="text-sm text-muted-foreground print:hidden">
                            {`No completed visits in this period: ${idleArtists.map((sheet) => sheet.artist.name).join(", ")}.`}
                        </p>
                    )}
                </>
            )}
        </div>
    )
}

// All artists only, on screen only (never printed — the sheets handed to
// artists don't compare them with named colleagues): the salon's totals,
// each artist's line, and sales by service across the salon.
function SalonTotals({
    figures,
    sheets,
    periodLabel,
}: {
    figures: VisitFigures[]
    sheets: { artist: { id: string; name: string }; figures: VisitFigures[] }[]
    periodLabel: string
}) {
    const salon = paySummary(figures)

    return (
        <section aria-labelledby="salon-totals" className="rounded-sm border border-border bg-surface p-4 sm:p-6 print:hidden">
            <h3 id="salon-totals" className="font-serif text-xl font-semibold text-foreground">
                Salon totals
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Shown on screen only; not included when printing.</p>

            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-xl border-collapse text-sm">
                    <caption className="sr-only">{`Pay by artist, ${periodLabel}`}</caption>
                    <thead>
                        <tr className="border-b-2 border-border text-xs uppercase tracking-wide text-muted-foreground">
                            <th scope="col" className="py-2 pr-2 text-left font-medium">
                                Artist
                            </th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">
                                Visits
                            </th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">
                                Total sales
                            </th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">
                                % of sales
                            </th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">
                                Commission
                            </th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">
                                Service fees
                            </th>
                            <th scope="col" className="py-2 pl-2 text-right font-medium">
                                Take-home
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sheets.map(({ artist, figures: rows }) => {
                            const summary = paySummary(rows)
                            return (
                                <tr key={artist.id} className="border-b border-border/15">
                                    <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                                        <a href={`#pay-sheet-${artist.id}`} className="underline">
                                            {artist.name}
                                        </a>
                                    </th>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{summary.visitCount}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{formatPrice(summary.salesCents)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">
                                        {formatShare(salon.salesCents === 0 ? null : summary.salesCents / salon.salesCents)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{money(summary.commissionCents)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{formatPrice(summary.serviceFeeCents)}</td>
                                    <td className="py-1.5 pl-2 text-right tabular-nums">{money(summary.takeHomeCents)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-border font-semibold">
                            <th scope="row" className="py-2 pr-2 text-left">
                                Salon
                            </th>
                            <td className="px-2 py-2 text-right tabular-nums">{salon.visitCount}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatPrice(salon.salesCents)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatShare(salon.salesCents === 0 ? null : 1)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{money(salon.commissionCents)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatPrice(salon.serviceFeeCents)}</td>
                            <td className="py-2 pl-2 text-right tabular-nums">{money(salon.takeHomeCents)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
                {salon.salonKeepsCents === null
                    ? "What the salon keeps can't be worked out until every artist with visits has a commission rate."
                    : `The salon keeps ${formatPrice(salon.salonKeepsCents)} of ${formatPrice(salon.salesCents)} in sales${salon.salesCents === 0 ? "" : ` (${formatShare(salon.salonKeepsCents / salon.salesCents)})`}.`}
            </p>

            <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sales by service, all artists
            </h4>
            <SalesTable sales={salesByService(figures)} caption={`Sales by service for all artists, ${periodLabel}`} />
        </section>
    )
}
