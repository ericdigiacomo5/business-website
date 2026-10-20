// Run with `npm test`. Expected figures worked out by hand from the fixtures.

import { test } from "node:test"
import assert from "node:assert/strict"
import { isNoShowFlagged, noShowLabel, summarizeCustomer, type SummaryAppointment } from "@/lib/customer-summary"

const NOW = new Date("2026-10-19T12:00:00")

function visit(
    startTime: string,
    status: SummaryAppointment["status"],
    artist: string,
    services: [name: string, priceCents: number][],
    discount: Pick<SummaryAppointment, "discountType" | "discountValue"> = { discountType: null, discountValue: null }
): SummaryAppointment {
    return {
        startTime,
        status,
        ...discount,
        artist: { name: artist },
        services: services.map(([name, priceCents]) => ({ priceCents, service: { name } })),
    }
}

test("a customer with no history has empty figures, not zeros pretending to be rates", () => {
    const summary = summarizeCustomer([], NOW)
    assert.equal(summary.visits, 0)
    assert.equal(summary.spentCents, 0)
    assert.equal(summary.averageCents, null)
    assert.equal(summary.lastVisit, null)
    assert.equal(summary.nextVisit, null)
    assert.equal(summary.usualArtist, null)
    assert.deepEqual(summary.topServices, [])
    assert.equal(summary.noShowRate, null)
})

test("spend counts completed visits only, after discounts", () => {
    const summary = summarizeCustomer(
        [
            // $40 + $25 = $65, 10% off = $58.50
            visit("2026-09-01T10:00:00", "COMPLETED", "Libby", [["Gel", 4000], ["Polish", 2500]], {
                discountType: "PERCENT",
                discountValue: 10,
            }),
            // $40, $5 off = $35
            visit("2026-09-15T10:00:00", "COMPLETED", "Libby", [["Gel", 4000]], {
                discountType: "AMOUNT",
                discountValue: 500,
            }),
            // Not counted.
            visit("2026-09-20T10:00:00", "CANCELLED", "Libby", [["Gel", 4000]]),
            visit("2026-09-25T10:00:00", "NO_SHOW", "Libby", [["Gel", 4000]]),
        ],
        NOW
    )
    assert.equal(summary.visits, 2)
    assert.equal(summary.spentCents, 5850 + 3500)
    // 9350 / 2 = 4675
    assert.equal(summary.averageCents, 4675)
    assert.equal(summary.cancellations, 1)
    assert.equal(summary.noShows, 1)
    // 1 missed of 3 expected
    assert.equal(summary.noShowRate, 1 / 3)
})

test("last and next visit come from completed and still-open bookings", () => {
    const summary = summarizeCustomer(
        [
            visit("2026-09-01T10:00:00", "COMPLETED", "Libby", [["Gel", 4000]]),
            visit("2026-10-05T10:00:00", "COMPLETED", "Libby", [["Gel", 4000]]),
            visit("2026-11-02T10:00:00", "CONFIRMED", "Libby", [["Gel", 4000]]),
            visit("2026-10-26T10:00:00", "PENDING", "Libby", [["Gel", 4000]]),
            // Cancelled future booking isn't "next".
            visit("2026-10-20T10:00:00", "CANCELLED", "Libby", [["Gel", 4000]]),
            // Open but already past (not checked out yet) isn't "next" either.
            visit("2026-10-19T09:00:00", "CONFIRMED", "Libby", [["Gel", 4000]]),
        ],
        NOW
    )
    assert.deepEqual(summary.lastVisit, new Date("2026-10-05T10:00:00"))
    assert.deepEqual(summary.nextVisit, new Date("2026-10-26T10:00:00"))
})

test("usual artist and top services rank by count, ties going to the most recent", () => {
    const summary = summarizeCustomer(
        [
            visit("2026-08-01T10:00:00", "COMPLETED", "Barbara", [["Pedicure", 3500]]),
            visit("2026-08-15T10:00:00", "COMPLETED", "Libby", [["Gel", 4000], ["Pedicure", 3500]]),
            visit("2026-09-01T10:00:00", "COMPLETED", "Barbara", [["Wax", 1500]]),
            visit("2026-09-15T10:00:00", "COMPLETED", "Libby", [["Gel", 4000], ["Art", 1000]]),
            // A no-show with someone else doesn't make them the usual artist.
            visit("2026-10-01T10:00:00", "NO_SHOW", "Cara", [["Gel", 4000]]),
        ],
        NOW
    )
    // Libby 2, Barbara 2 — Libby's visit is more recent.
    assert.equal(summary.usualArtist, "Libby")
    // Gel 2, Pedicure 2 (Gel more recent), then Art (1, more recent than Wax).
    assert.deepEqual(summary.topServices, ["Gel", "Pedicure", "Art"])
})

test("the no-show flag starts at two", () => {
    assert.equal(isNoShowFlagged(1), false)
    assert.equal(isNoShowFlagged(2), true)
    assert.equal(noShowLabel(1), "1 no-show")
    assert.equal(noShowLabel(3), "3 no-shows")
})
