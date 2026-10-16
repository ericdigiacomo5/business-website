// Client-safe (type-only Prisma import, erased at compile time) — shared by
// the admin appointment route, the schedule detail sheet, the customer
// bookings list and the receipt email, so the discount math exists once.

import type { DiscountType } from "@/generated/prisma/client"
import { formatPrice } from "@/lib/format"

// PERCENT: a whole percentage, 1-100. AMOUNT: cents off.
export type Discount = { type: DiscountType; value: number }

// The two nullable columns on Appointment, read back as one value. Both are
// always set or cleared together (the admin route is the only writer).
export function discountOf(appointment: {
    discountType: DiscountType | null
    discountValue: number | null
}): Discount | null {
    if (appointment.discountType === null || appointment.discountValue === null) return null
    return { type: appointment.discountType, value: appointment.discountValue }
}

// Cents taken off. Capped at the price so a total can never go negative —
// e.g. a dollar discount set before an admin removed a service from the
// appointment (each line's price is snapshotted at booking, so a later
// change to the Service's own price doesn't affect this).
export function discountCents(priceCents: number, discount: Discount | null): number {
    if (!discount) return 0
    const off = discount.type === "PERCENT" ? Math.round((priceCents * discount.value) / 100) : discount.value
    return Math.min(off, priceCents)
}

export function totalCents(priceCents: number, discount: Discount | null): number {
    return priceCents - discountCents(priceCents, discount)
}

// "10% off" / "$5.00 off"
export function describeDiscount(discount: Discount): string {
    return discount.type === "PERCENT" ? `${discount.value}% off` : `${formatPrice(discount.value)} off`
}

// Returns why a discount isn't valid for this price, or null if it is. Used
// by the form for instant feedback and by the route as the real check.
export function discountError(discount: { type: unknown; value: unknown }, priceCents: number): string | null {
    if (discount.type !== "PERCENT" && discount.type !== "AMOUNT") {
        return "Discount type must be PERCENT or AMOUNT"
    }
    if (typeof discount.value !== "number" || !Number.isInteger(discount.value) || discount.value < 1) {
        return discount.type === "PERCENT"
            ? "Percentage must be a whole number from 1 to 100"
            : "Amount must be at least $0.01"
    }
    if (discount.type === "PERCENT" && discount.value > 100) {
        return "Percentage must be a whole number from 1 to 100"
    }
    if (discount.type === "AMOUNT" && discount.value > priceCents) {
        return "Amount can't be more than the service price"
    }
    return null
}
