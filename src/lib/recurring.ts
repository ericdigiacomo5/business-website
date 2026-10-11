// This module must stay free of server-only imports (Prisma included) — it's
// shared with Client Components (review-step.tsx imports MATERIALIZE_WEEKS,
// datetime-step.tsx imports BOOKING_WINDOW_DAYS),
// and a single server-only import anywhere in the file pulls the whole
// module, and everything it imports, into the browser bundle. This is the
// same RSC-boundary failure mode documented in PROJECT_STATUS.md's
// salon-wide-closures write-up, just triggered by an import instead of a
// re-exported value. Server-side logic for this model (the shared
// pause/resume/cancel transaction) lives in src/lib/booking.ts instead,
// alongside bookOccurrence() — that file has no client consumers.

import { startOfDay } from "@/lib/schedule-grid";

// How far ahead a standing appointment is kept booked as real Appointment
// rows. Applied at creation, then kept rolling by the daily materialization
// job (POST /api/jobs/materialize-recurring), so indefinite series keep
// getting new occurrences without storing an unbounded number of rows.
export const MATERIALIZE_WEEKS = 8;

// How far ahead a customer may book (server-enforced in both booking routes;
// admins are exempt). This is what makes rolling materialization race-free:
// as long as a series is always booked further ahead than any customer can
// reach, a customer can never take a standing customer's week before the
// series claims it. See PLAN_RECURRING_MATERIALIZATION.md.
export const BOOKING_WINDOW_DAYS = 14;

// How many days the date picker offers admins (reschedule, /admin/book) —
// about a quarter. Admins aren't bound by the customer window, and this must
// reach past the standing horizon (56 days): that's exactly where an admin
// one-off can collide with a standing appointment's not-yet-booked week,
// which the review step warns about. A strip that stopped at the horizon
// would make that warning unreachable (found in browser verification).
export const ADMIN_DAYS_AHEAD = 90;

// Fail loudly at startup if a future edit to either constant would silently
// reopen that race.
if (MATERIALIZE_WEEKS * 7 <= BOOKING_WINDOW_DAYS) {
    throw new Error(
        `MATERIALIZE_WEEKS (${MATERIALIZE_WEEKS}) must cover more than BOOKING_WINDOW_DAYS (${BOOKING_WINDOW_DAYS}) — ` +
            "otherwise customers could book a standing appointment's week before the series claims it."
    );
}

// Why a week of a standing appointment couldn't be booked. Stored on
// RecurringSkippedOccurrence and shown to customers/admins as-is. Lives here
// (client-safe) rather than in booking.ts so UI code can compare against it.
export const SKIP_REASON = {
    UNAVAILABLE: "That time wasn't available",
    ARTIST_INACTIVE: "The artist is no longer taking bookings",
    PASSED: "The date had already passed",
} as const;

// Skips worth telling the customer about. An inactive artist is an admin
// problem to resolve (reassign or cancel the series) — emailing it would send
// a fresh "couldn't book" email every week until someone acts. A date that
// already passed only happens when the job hasn't run for a while, which the
// customer can't act on either.
export function isCustomerNotifiableSkip(reason: string): boolean {
    return reason === SKIP_REASON.UNAVAILABLE;
}

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

// Furthest occurrence date the materializer books up to.
export function materializationHorizon(now: Date = new Date()): Date {
    return addDays(startOfDay(now), MATERIALIZE_WEEKS * 7);
}

// Calendar dates (midnight local time, no time-of-day) on which a recurring
// rule produces an occurrence, starting at seriesStart, up to whichever
// comes first: seriesEnd, or horizonEnd (how far ahead to materialize).
export function generateOccurrenceDates(
    seriesStart: Date,
    intervalWeeks: number,
    horizonEnd: Date,
    seriesEnd: Date | null
): Date[] {
    const cutoff = seriesEnd && seriesEnd.getTime() < horizonEnd.getTime() ? seriesEnd : horizonEnd;

    const dates: Date[] = [];
    let current = seriesStart;
    while (current.getTime() <= cutoff.getTime()) {
        dates.push(current);
        current = addDays(current, intervalWeeks * 7);
    }
    return dates;
}
