// This module must stay free of server-only imports (Prisma included) — it's
// shared with Client Components (review-step.tsx imports maxSeriesEnd,
// datetime-step.tsx imports BOOKING_WINDOW_DAYS),
// and a single server-only import anywhere in the file pulls the whole
// module, and everything it imports, into the browser bundle. This is the
// same RSC-boundary failure mode documented in PROJECT_STATUS.md's
// salon-wide-closures write-up, just triggered by an import instead of a
// re-exported value. Server-side logic for this model (the shared cancel
// transaction) lives in src/lib/booking.ts instead,
// alongside bookOccurrence() — that file has no client consumers.

import { startOfDay } from "@/lib/schedule-grid";

// Longest a standing appointment may run, start to end. Every standing
// appointment has a mandatory end date and all of its weeks are booked as
// real Appointment rows when it's created, so this is also what bounds how
// many rows (and how much of an artist's calendar) one request can claim.
export const MAX_SERIES_WEEKS = 52;

// How far ahead a customer may book a one-off, or start a standing
// appointment (server-enforced in both booking routes; admins are exempt).
export const BOOKING_WINDOW_DAYS = 14;

// How many days the date picker offers admins (reschedule) —
// about a quarter. Admins aren't bound by the customer window.
export const ADMIN_DAYS_AHEAD = 90;

// Why a week of a standing appointment couldn't be booked. Stored on
// RecurringSkippedOccurrence and shown to customers/admins as-is. Lives here
// (client-safe) rather than in booking.ts so UI code can compare against it.
export const SKIP_REASON = {
    UNAVAILABLE: "That time wasn't available",
} as const;

// setDate (not raw ms arithmetic) so a week-boundary that crosses a DST
// transition still lands on the same local wall-clock time — adding
// 7*24*60*60*1000 ms would drift by an hour on that week.
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Exclusive upper bound for a customer booking's startTime: midnight at the
// start of day BOOKING_WINDOW_DAYS, so "14 days" means today plus the next
// 13 — exactly the days the booking wizard's day strip shows.
export function bookingWindowEnd(now: Date = new Date()): Date {
    return addDays(startOfDay(now), BOOKING_WINDOW_DAYS);
}

// Latest end date allowed for a series starting on seriesStart (inclusive).
export function maxSeriesEnd(seriesStart: Date): Date {
    return addDays(startOfDay(seriesStart), MAX_SERIES_WEEKS * 7);
}

// Calendar dates (midnight local time, no time-of-day) on which a recurring
// rule produces an occurrence, from seriesStart through seriesEnd inclusive.
export function generateOccurrenceDates(
    seriesStart: Date,
    intervalWeeks: number,
    seriesEnd: Date
): Date[] {
    const dates: Date[] = [];
    let current = seriesStart;
    while (current.getTime() <= seriesEnd.getTime()) {
        dates.push(current);
        current = addDays(current, intervalWeeks * 7);
    }
    return dates;
}
