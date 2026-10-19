// Run with `npm test`. Expected figures were worked out by hand first (see
// the comments on each fixture), then asserted here.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
    allocateDiscount,
    clientShortName,
    commissionCents,
    daysInRange,
    formatDateRange,
    formatRate,
    formatShare,
    paySummary,
    percentToBasisPoints,
    rangeError,
    reportPresets,
    salesByService,
    visitFigures,
    type PayReportLine,
    type PayReportVisit,
} from "@/lib/pay-report"

const GEL: Omit<PayReportLine, "priceCents" | "serviceFeeCents"> = {
    serviceId: "gel",
    serviceName: "Gel Manicure",
    category: "HANDS",
}
const MANI = { serviceId: "mani", serviceName: "Manicure", category: "HANDS" } as const
const PEDI = { serviceId: "pedi", serviceName: "Pedicure", category: "FEET" } as const
const BROW = { serviceId: "brow", serviceName: "Eyebrow Wax", category: "WAX" } as const

function visit(overrides: Partial<PayReportVisit> & Pick<PayReportVisit, "id" | "lines">): PayReportVisit {
    return {
        artistId: "libby",
        startTime: new Date(2026, 9, 14, 10),
        createdAt: new Date(2026, 9, 14, 9),
        clientName: "Client",
        discount: null,
        paymentMethod: "CARD",
        creditAppliedCents: 0,
        commissionBasisPoints: 4500,
        commissionBackfilled: false,
        ...overrides,
    }
}

// A: $40 gel, no discount, 45%           -> sales 4000, commission 1800, fee 200
// B: $25 mani + $45 pedi, 10% off (700)  -> lines 2250 + 4050 = 6300, commission 2835, fees 400
// C: $25 mani + $15 brow, $3.33 off      -> exact shares 208.125 / 124.875; the leftover cent goes to the
//                                           larger remainder (brow): 208 / 125,
//                                           lines 2292 + 1375 = 3667, commission 1650.15 -> 1650, fee 100
// D: $45 pedi at 50% (rate changed)      -> sales 4500, commission 2250, fee 300
const PERIOD = [
    visit({ id: "A", lines: [{ ...GEL, priceCents: 4000, serviceFeeCents: 200 }] }),
    visit({
        id: "B",
        discount: { type: "PERCENT", value: 10 },
        lines: [
            { ...MANI, priceCents: 2500, serviceFeeCents: 100 },
            { ...PEDI, priceCents: 4500, serviceFeeCents: 300 },
        ],
    }),
    visit({
        id: "C",
        discount: { type: "AMOUNT", value: 333 },
        lines: [
            { ...MANI, priceCents: 2500, serviceFeeCents: 100 },
            { ...BROW, priceCents: 1500, serviceFeeCents: 0 },
        ],
    }),
    visit({
        id: "D",
        commissionBasisPoints: 5000,
        lines: [{ ...PEDI, priceCents: 4500, serviceFeeCents: 300 }],
    }),
]

test("allocateDiscount splits by price, leftover cents by largest remainder", () => {
    assert.deepEqual(allocateDiscount([2500, 4500], 700), [250, 450])
    assert.deepEqual(allocateDiscount([2500, 1500], 333), [208, 125])
    // Equal remainders and prices: the earlier line gets the leftover.
    assert.deepEqual(allocateDiscount([1000, 1000, 1000], 100), [34, 33, 33])
    // Equal remainders: the higher price gets it.
    assert.deepEqual(allocateDiscount([1000, 3000], 1), [0, 1])
    // The case that breaks "all leftover to the largest line".
    assert.deepEqual(allocateDiscount([1, 1, 1], 2), [1, 1, 0])
    assert.deepEqual(allocateDiscount([2000], 0), [0])
    assert.deepEqual(allocateDiscount([0, 0], 0), [0, 0])
})

test("allocateDiscount always sums to the discount", () => {
    for (const [prices, discount] of [
        [[1, 1, 1], 2],
        [[999, 1, 3333], 1234],
        [[4500, 2500, 1500, 0], 8500],
    ] as const) {
        const shares = allocateDiscount([...prices], discount)
        assert.equal(
            shares.reduce((a, b) => a + b, 0),
            discount,
        )
        // No line is discounted below $0.
        shares.forEach((share, i) => assert.ok(share <= prices[i]))
    }
})

test("commissionCents rounds half up per visit", () => {
    assert.equal(commissionCents(3667, 4500), 1650)
    assert.equal(commissionCents(1, 5000), 1)
    assert.equal(commissionCents(3, 5000), 2)
    assert.equal(commissionCents(0, 4500), 0)
})

test("visitFigures applies the discount once and keeps lines summing to sales", () => {
    const c = visitFigures(PERIOD[2])
    assert.equal(c.grossCents, 4000)
    assert.equal(c.discountCents, 333)
    assert.equal(c.salesCents, 3667)
    assert.deepEqual(c.lineSalesCents, [2292, 1375])
    assert.equal(c.commissionCents, 1650)
    assert.equal(c.serviceFeeCents, 100)
})

test("a dollar discount larger than the price is capped, so sales never go negative", () => {
    const figures = visitFigures(
        visit({ id: "X", discount: { type: "AMOUNT", value: 5000 }, lines: [{ ...GEL, priceCents: 4000, serviceFeeCents: 0 }] }),
    )
    assert.equal(figures.salesCents, 0)
    assert.equal(figures.commissionCents, 0)
})

test("salesByService groups by category, in category order, sorted by sales", () => {
    const { categories, totals } = salesByService(PERIOD.map(visitFigures))

    assert.deepEqual(
        categories.map((c) => c.label),
        ["Hands", "Feet", "Wax"],
    )

    const hands = categories[0]
    assert.deepEqual(
        hands.rows.map((r) => [r.serviceName, r.count, r.salesCents, r.averageCents, r.serviceFeeCents]),
        [
            ["Manicure", 2, 4542, 2271, 200],
            ["Gel Manicure", 1, 4000, 4000, 200],
        ],
    )
    assert.equal(hands.totals.salesCents, 8542)
    assert.equal(categories[2].rows[0].salesCents, 1375)
    assert.equal(hands.totals.count, 3)

    const feet = categories[1]
    assert.deepEqual(
        feet.rows.map((r) => [r.serviceName, r.count, r.salesCents, r.averageCents, r.serviceFeeCents]),
        [["Pedicure", 2, 8550, 4275, 600]],
    )

    assert.equal(totals.count, 6)
    assert.equal(totals.salesCents, 18467)
    assert.equal(totals.serviceFeeCents, 1000)
    assert.equal(totals.shareOfSales, 1)

    // Shares are of the report's total sales and add up to 100%.
    const shares = categories.flatMap((c) => c.rows.map((r) => r.shareOfSales ?? 0))
    assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-9)
    assert.equal(feet.rows[0].shareOfSales, 8550 / 18467)
})

test("paySummary reconciles: commission − fees = take-home, take-home + salon = sales", () => {
    const summary = paySummary(PERIOD.map(visitFigures))

    assert.equal(summary.visitCount, 4)
    assert.equal(summary.serviceCount, 6)
    assert.equal(summary.grossCents, 19500)
    assert.equal(summary.discountCents, 1033)
    assert.equal(summary.salesCents, 18467)
    assert.deepEqual(summary.ratesBasisPoints, [4500, 5000])
    assert.equal(summary.commissionCents, 8535)
    assert.equal(summary.serviceFeeCents, 1000)
    assert.equal(summary.takeHomeCents, 7535)
    assert.equal(summary.salonKeepsCents, 10932)
    assert.equal((summary.takeHomeCents ?? 0) + (summary.salonKeepsCents ?? 0), summary.salesCents)
})

test("a visit without a rate leaves commission and take-home unknown, not zero", () => {
    const summary = paySummary([...PERIOD, visit({ id: "E", commissionBasisPoints: null, lines: [{ ...GEL, priceCents: 4000, serviceFeeCents: 200 }] })].map(visitFigures))
    assert.equal(summary.visitsWithoutRate, 1)
    assert.equal(summary.commissionCents, null)
    assert.equal(summary.takeHomeCents, null)
    assert.equal(summary.salonKeepsCents, null)
    // Sales and fees are still known.
    assert.equal(summary.salesCents, 22467)
    assert.equal(summary.serviceFeeCents, 1200)
})

test("an empty period has zero totals and no shares", () => {
    const summary = paySummary([])
    assert.equal(summary.salesCents, 0)
    assert.equal(summary.takeHomeCents, 0)
    const { categories, totals } = salesByService([])
    assert.equal(categories.length, 0)
    assert.equal(totals.shareOfSales, null)
    assert.equal(totals.averageCents, null)
})

test("caveats count backfilled rates and pre-snapshot prices", () => {
    const summary = paySummary(
        [
            visit({ id: "old", createdAt: new Date(2026, 9, 1), lines: [{ ...GEL, priceCents: 4000, serviceFeeCents: 0 }] }),
            visit({ id: "filled", commissionBackfilled: true, lines: [{ ...GEL, priceCents: 4000, serviceFeeCents: 0 }] }),
        ].map(visitFigures),
    )
    assert.equal(summary.backfilledPriceVisits, 1)
    assert.equal(summary.backfilledRateVisits, 1)
})

test("date range helpers", () => {
    // Nov 1, 2026 is a DST change in New York; still 14 calendar days.
    assert.equal(daysInRange(new Date(2026, 9, 26), new Date(2026, 10, 8)), 14)
    assert.equal(daysInRange(new Date(2026, 9, 18), new Date(2026, 9, 18)), 1)
    assert.equal(rangeError(new Date(2026, 9, 19), new Date(2026, 9, 18)), "The start date must be on or before the end date.")
    assert.equal(rangeError(new Date(2025, 9, 18), new Date(2026, 9, 18)), null)
    assert.ok(rangeError(new Date(2025, 9, 17), new Date(2026, 9, 18)))

    const presets = reportPresets(new Date(2026, 2, 10, 15, 30))
    const byLabel = Object.fromEntries(presets.map((p) => [p.label, [p.from, p.to]]))
    assert.deepEqual(byLabel["Last 7 days"], [new Date(2026, 2, 4), new Date(2026, 2, 10)])
    assert.deepEqual(byLabel["Last 14 days"], [new Date(2026, 1, 25), new Date(2026, 2, 10)])
    assert.deepEqual(byLabel["This month"], [new Date(2026, 2, 1), new Date(2026, 2, 10)])
    assert.deepEqual(byLabel["Last month"], [new Date(2026, 1, 1), new Date(2026, 1, 28)])
    // January's "last month" is the previous December.
    const january = reportPresets(new Date(2027, 0, 5)).find((p) => p.label === "Last month")
    assert.deepEqual([january?.from, january?.to], [new Date(2026, 11, 1), new Date(2026, 11, 31)])

    assert.equal(formatDateRange(new Date(2026, 9, 5), new Date(2026, 9, 18)), "Oct 5 – 18, 2026")
    assert.equal(formatDateRange(new Date(2026, 8, 28), new Date(2026, 9, 11)), "Sep 28 – Oct 11, 2026")
    assert.equal(formatDateRange(new Date(2026, 11, 22), new Date(2027, 0, 4)), "Dec 22, 2026 – Jan 4, 2027")
    assert.equal(formatDateRange(new Date(2026, 9, 18), new Date(2026, 9, 18)), "Oct 18, 2026")
})

test("formatting and parsing helpers", () => {
    assert.equal(clientShortName("Jane Doe"), "Jane D.")
    assert.equal(clientShortName("  mary ann  smith "), "mary S.")
    assert.equal(clientShortName("Cher"), "Cher")
    assert.equal(clientShortName("   "), null)
    assert.equal(clientShortName(null), null)
    assert.equal(formatRate(4500), "45%")
    assert.equal(formatRate(4250), "42.5%")
    assert.equal(formatRate(3333), "33.33%")
    assert.equal(formatShare(8550 / 18467), "46.3%")
    assert.equal(formatShare(null), "—")
    assert.equal(percentToBasisPoints("45"), 4500)
    assert.equal(percentToBasisPoints(" 42.5 "), 4250)
    assert.equal(percentToBasisPoints("100"), 10000)
    assert.equal(percentToBasisPoints("100.01"), null)
    assert.equal(percentToBasisPoints("-5"), null)
    assert.equal(percentToBasisPoints("4.555"), null)
    assert.equal(percentToBasisPoints(""), null)
})
