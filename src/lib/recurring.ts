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

// The two salon policies an admin can change on the dashboard (stored in
// AppSettings; read server-side via getPolicySettings() in settings.ts).
// These are the defaults — the migration's column defaults match — and the
// bounds the admin settings route accepts.
//
// cancellationNoticeHours: how close to an appointment a customer can still
// cancel or reschedule it online. maxSeriesWeeks: longest a standing
// appointment may run. Every standing appointment has a mandatory end date
// and all of its weeks are booked as real Appointment rows when it's
// created, so this also bounds how many rows (and how much of an artist's
// calendar) one request can claim.
export const DEFAULT_POLICY = { cancellationNoticeHours: 24, maxSeriesWeeks: 52 } as const;
export const POLICY_LIMITS = {
    cancellationNoticeHours: { min: 0, max: 168 }, // up to one week
    maxSeriesWeeks: { min: 1, max: 104 }, // up to two years
} as const;
export type PolicySettings = { cancellationNoticeHours: number; maxSeriesWeeks: number };

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

// Latest end date allowed for a series starting on seriesStart (inclusive),
// given the salon's current maxSeriesWeeks setting.
export function maxSeriesEnd(seriesStart: Date, maxSeriesWeeks: number): Date {
    return addDays(startOfDay(seriesStart), maxSeriesWeeks * 7);
}

// The latest moment an appointment starting at `startTime` can still be
// cancelled or rescheduled by the customer online — the server check and
// the My Bookings buttons both use this, so they always agree.
export function customerChangeDeadline(startTime: Date | string, cancellationNoticeHours: number): Date {
    return new Date(new Date(startTime).getTime() - cancellationNoticeHours * 60 * 60 * 1000);
}

// "24 hours" / "1 hour" / "2 days" — how the notice window is described to
// customers (About page, My Bookings, error messages).
export function describeNoticeWindow(hours: number): string {
    if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days`;
    return hours === 1 ? "1 hour" : `${hours} hours`;
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
