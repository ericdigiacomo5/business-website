// Client-safe (type-only Prisma imports) — every figure on the artist pay
// report (/admin/reports/pay) is worked out here, from plain visit records,
// so all of the money math is in one tested place
// (pay-report.test.ts). Loading those records is pay-report-data.ts's job.
// See PLAN_ARTIST_PAY_REPORT.md for the reasoning behind each rule.
//
// Rules, in short:
// - Only COMPLETED appointments count (the loader filters), attributed to
//   the day they happened (startTime), not when they were checked out.
// - "Sales" are what the client paid for the services after the
//   appointment's discount — before store credit, which is just how the
//   client paid (as are Groupon and gift cards, counted at face value).
// - Commission is a share of sales, rounded per visit; service fees are a
//   fixed amount per service performed, charged to the artist.
// - Take-home = commission − service fees.

import type { PaymentMethod, ServiceType } from "@/generated/prisma/client"
import { discountCents, type Discount } from "@/lib/discount"
import { addDays } from "@/lib/recurring"
import { startOfDay, startOfMonth } from "@/lib/schedule-grid"
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABEL } from "@/lib/service-category"

export type PayReportLine = {
    serviceId: string
    serviceName: string
    category: ServiceType
    // Booked price, snapshotted on the line at booking.
    priceCents: number
    // Snapshotted at checkout (0 when the service has no fee).
    serviceFeeCents: number
}

export type PayReportVisit = {
    id: string
    artistId: string
    startTime: Date
    // When it was booked — line prices on bookings made before
    // LINE_PRICES_RECORDED_FROM were backfilled, which the report notes.
    createdAt: Date
    clientName: string | null
    discount: Discount | null
    paymentMethod: PaymentMethod | null
    creditAppliedCents: number
    // Snapshotted at checkout; null = the artist had no rate set yet.
    commissionBasisPoints: number | null
    // The rate was filled in later, when it was first set (see AppointmentPay).
    commissionBackfilled: boolean
    lines: PayReportLine[]
}

// Bookings made before the multi-service migration (2026-10-13, local) had
// their line prices filled in from the services' prices at that time, so a
// report covering them may be slightly off.
export const LINE_PRICES_RECORDED_FROM = new Date(2026, 9, 13)

// ---------------------------------------------------------------------------
// One visit

// Splits an appointment-level discount across its lines in proportion to
// each line's price, so per-service sales add up exactly to the visit's
// total. Largest-remainder rounding: each share is rounded down, then the
// cents left over (fewer than the number of lines) go one each to the lines
// whose exact share was rounded down the most — ties to the higher price,
// then the earlier line. That keeps every share within a cent of exact, so
// no line is ever discounted below $0 (giving all the leftover to one line
// can do that: three $0.01 lines, $0.02 off). Returns cents off per line.
export function allocateDiscount(linePriceCents: number[], totalDiscountCents: number): number[] {
    const totalPrice = linePriceCents.reduce((sum, cents) => sum + cents, 0)
    if (totalDiscountCents <= 0 || totalPrice <= 0) return linePriceCents.map(() => 0)

    // Integer arithmetic throughout: share = floor(exact), and the remainder
    // (exact − share) × totalPrice, which orders lines the same as the
    // fractional remainder would, without floating point.
    const parts = linePriceCents.map((cents, index) => {
        const scaled = cents * totalDiscountCents
        return { index, cents, share: Math.floor(scaled / totalPrice), remainder: scaled % totalPrice }
    })
    let leftover = totalDiscountCents - parts.reduce((sum, part) => sum + part.share, 0)

    const order = [...parts].sort((a, b) => b.remainder - a.remainder || b.cents - a.cents || a.index - b.index)
    for (const part of order) {
        if (leftover === 0) break
        part.share += 1
        leftover -= 1
    }
    return parts.map((part) => part.share)
}

// Commission on one visit's sales, rounded half up to the cent. Rounding per
// visit (then summing) means every line on the itemized list can be checked
// by hand and the lines add up to the total exactly.
export function commissionCents(salesCents: number, basisPoints: number): number {
    return Math.round((salesCents * basisPoints) / 10_000)
}

export type VisitFigures = {
    visit: PayReportVisit
    grossCents: number
    discountCents: number
    salesCents: number
    // Same order as visit.lines.
    lineSalesCents: number[]
    commissionCents: number | null
    serviceFeeCents: number
}

export function visitFigures(visit: PayReportVisit): VisitFigures {
    const prices = visit.lines.map((line) => line.priceCents)
    const grossCents = prices.reduce((sum, cents) => sum + cents, 0)
    const discount = discountCents(grossCents, visit.discount)
    const lineDiscounts = allocateDiscount(prices, discount)
    const salesCents = grossCents - discount

    return {
        visit,
        grossCents,
        discountCents: discount,
        salesCents,
        lineSalesCents: prices.map((cents, index) => cents - lineDiscounts[index]),
        commissionCents:
            visit.commissionBasisPoints === null ? null : commissionCents(salesCents, visit.commissionBasisPoints),
        serviceFeeCents: visit.lines.reduce((sum, line) => sum + line.serviceFeeCents, 0),
    }
}

// ---------------------------------------------------------------------------
// Sales by service, grouped by category

export type ServiceSalesRow = {
    serviceId: string
    serviceName: string
    count: number
    salesCents: number
    // Rounded to the cent; null when nothing was sold (can't happen for a
    // listed row, but keeps the type honest for totals).
    averageCents: number | null
    // Fraction (0-1) of the report's total sales; null when total sales are $0.
    shareOfSales: number | null
    serviceFeeCents: number
}

export type SalesTotals = Omit<ServiceSalesRow, "serviceId" | "serviceName">

export type CategorySales = {
    category: ServiceType
    label: string
    rows: ServiceSalesRow[]
    totals: SalesTotals
}

export type SalesByService = { categories: CategorySales[]; totals: SalesTotals }

function totalsOf(rows: { count: number; salesCents: number; serviceFeeCents: number }[], allSalesCents: number) {
    const count = rows.reduce((sum, row) => sum + row.count, 0)
    const salesCents = rows.reduce((sum, row) => sum + row.salesCents, 0)
    return {
        count,
        salesCents,
        averageCents: count === 0 ? null : Math.round(salesCents / count),
        shareOfSales: allSalesCents === 0 ? null : salesCents / allSalesCents,
        serviceFeeCents: rows.reduce((sum, row) => sum + row.serviceFeeCents, 0),
    }
}

// Categories in their usual display order (SERVICE_CATEGORIES), empty ones
// left out; services within a category by sales, highest first, then name.
export function salesByService(figures: VisitFigures[]): SalesByService {
    const byService = new Map<
        string,
        { serviceName: string; category: ServiceType; count: number; salesCents: number; serviceFeeCents: number }
    >()

    for (const visit of figures) {
        visit.visit.lines.forEach((line, index) => {
            const row = byService.get(line.serviceId) ?? {
                serviceName: line.serviceName,
                category: line.category,
                count: 0,
                salesCents: 0,
                serviceFeeCents: 0,
            }
            row.count += 1
            row.salesCents += visit.lineSalesCents[index]
            row.serviceFeeCents += line.serviceFeeCents
            byService.set(line.serviceId, row)
        })
    }

    const allSalesCents = [...byService.values()].reduce((sum, row) => sum + row.salesCents, 0)

    const categories: CategorySales[] = []
    for (const category of SERVICE_CATEGORIES) {
        const rows: ServiceSalesRow[] = [...byService.entries()]
            .filter(([, row]) => row.category === category)
            .map(([serviceId, row]) => ({
                serviceId,
                serviceName: row.serviceName,
                ...totalsOf([row], allSalesCents),
            }))
            .sort((a, b) => b.salesCents - a.salesCents || a.serviceName.localeCompare(b.serviceName))
        if (rows.length === 0) continue
        categories.push({
            category,
            label: SERVICE_CATEGORY_LABEL[category],
            rows,
            totals: totalsOf(rows, allSalesCents),
        })
    }

    return { categories, totals: totalsOf([...byService.values()], allSalesCents) }
}

// ---------------------------------------------------------------------------
// The summary box (the take-home answer)

export type PaySummary = {
    visitCount: number
    serviceCount: number
    grossCents: number
    discountCents: number
    salesCents: number
    // Every distinct rate used in the period, lowest first — normally one;
    // more if the rate changed mid-period.
    ratesBasisPoints: number[]
    // Visits checked out while the artist had no rate. While any exist,
    // commission and take-home can't be known and are null.
    visitsWithoutRate: number
    commissionCents: number | null
    serviceFeeCents: number
    takeHomeCents: number | null
    // What the salon keeps of the sales: sales − take-home.
    salonKeepsCents: number | null
    backfilledRateVisits: number
    // Visits whose line prices were backfilled (see LINE_PRICES_RECORDED_FROM).
    backfilledPriceVisits: number
}

export function paySummary(figures: VisitFigures[]): PaySummary {
    const sum = (pick: (visit: VisitFigures) => number) => figures.reduce((total, visit) => total + pick(visit), 0)

    const visitsWithoutRate = figures.filter((visit) => visit.commissionCents === null).length
    const salesCents = sum((visit) => visit.salesCents)
    const serviceFeeCents = sum((visit) => visit.serviceFeeCents)
    const commission = visitsWithoutRate > 0 ? null : sum((visit) => visit.commissionCents ?? 0)
    const takeHome = commission === null ? null : commission - serviceFeeCents

    const rates = new Set<number>()
    for (const visit of figures) {
        if (visit.visit.commissionBasisPoints !== null) rates.add(visit.visit.commissionBasisPoints)
    }

    return {
        visitCount: figures.length,
        serviceCount: sum((visit) => visit.visit.lines.length),
        grossCents: sum((visit) => visit.grossCents),
        discountCents: sum((visit) => visit.discountCents),
        salesCents,
        ratesBasisPoints: [...rates].sort((a, b) => a - b),
        visitsWithoutRate,
        commissionCents: commission,
        serviceFeeCents,
        takeHomeCents: takeHome,
        salonKeepsCents: takeHome === null ? null : salesCents - takeHome,
        backfilledRateVisits: figures.filter((visit) => visit.visit.commissionBackfilled).length,
        backfilledPriceVisits: figures.filter((visit) => visit.visit.createdAt < LINE_PRICES_RECORDED_FROM).length,
    }
}

// ---------------------------------------------------------------------------
// Date range

// Longest range one report may cover — a year and a day, so "same date last
// year to today" works. Bounds how much one page load reads.
export const MAX_REPORT_DAYS = 366

export const DEFAULT_REPORT_DAYS = 14

export type ReportPreset = { label: string; from: Date; to: Date }

// Quick picks until the salon's pay schedule is a setting (plan step 7).
export function reportPresets(today: Date): ReportPreset[] {
    const day = startOfDay(today)
    const monthStart = startOfMonth(day)
    const lastMonthEnd = addDays(monthStart, -1)
    return [
        { label: "Last 7 days", from: addDays(day, -6), to: day },
        { label: "Last 14 days", from: addDays(day, -(DEFAULT_REPORT_DAYS - 1)), to: day },
        { label: "This month", from: monthStart, to: day },
        { label: "Last month", from: startOfMonth(lastMonthEnd), to: lastMonthEnd },
    ]
}

// Inclusive count of calendar days. Rounded, so a DST change inside the
// range (a 23- or 25-hour day) doesn't throw it off.
export function daysInRange(from: Date, to: Date): number {
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1
}

export function rangeError(from: Date, to: Date): string | null {
    if (from > to) return "The start date must be on or before the end date."
    if (daysInRange(from, to) > MAX_REPORT_DAYS) return `A report can cover at most ${MAX_REPORT_DAYS} days.`
    return null
}

// "Oct 5 – 18, 2026", "Sep 28 – Oct 11, 2026", "Dec 22, 2026 – Jan 4, 2027",
// or "Oct 18, 2026" for a single day.
export function formatDateRange(from: Date, to: Date): string {
    const sameYear = from.getFullYear() === to.getFullYear()
    const sameMonth = sameYear && from.getMonth() === to.getMonth()
    const end = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    if (sameMonth && from.getDate() === to.getDate()) return end
    const start = from.toLocaleDateString(
        "en-US",
        sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" },
    )
    // Built by hand: Intl formats { day, year } alone as "2026 (day: 18)".
    const endText = sameMonth ? `${to.getDate()}, ${to.getFullYear()}` : end
    return `${start} – ${endText}`
}

// ---------------------------------------------------------------------------
// Formatting

// "Jane Doe" -> "Jane D." — enough for an artist to recognize the visit on
// a sheet that's handed over, without printing customers' full names.
export function clientShortName(name: string | null): string | null {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return null
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

// 4500 -> "45%", 4250 -> "42.5%"
export function formatRate(basisPoints: number): string {
    return `${Number((basisPoints / 100).toFixed(2))}%`
}

// 0.3504 -> "35.0%"; null -> "—"
export function formatShare(fraction: number | null): string {
    return fraction === null ? "—" : `${(fraction * 100).toFixed(1)}%`
}

// A percent the admin typed ("45", "42.5") -> basis points, or null when
// it isn't a percentage from 0 to 100 with at most two decimals. Used by the
// artist form for instant feedback; the route checks the basis points itself.
export function percentToBasisPoints(text: string): number | null {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text.trim())) return null
    const basisPoints = Math.round(Number(text.trim()) * 100)
    return basisPoints <= 10_000 ? basisPoints : null
}

export function isBasisPoints(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000
}

// A per-service fee charged to the artist: whole cents, $0 to $1,000.
export const MAX_SERVICE_FEE_CENTS = 100_000

export function isFeeCents(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SERVICE_FEE_CENTS
}
