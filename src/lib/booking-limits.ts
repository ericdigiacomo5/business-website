// How much of the calendar one customer can hold through online booking.
// Admins booking on someone's behalf are never limited by these. Plain
// module (no imports), so the booking wizard can show the same numbers the
// server enforces.
//
// Why they exist: signing up needs only an email the person can click a
// link in, and before these caps one account could book every week for a
// year at up to 8 hours a visit, in a single request — a handful of
// throwaway accounts could fill every artist's calendar.

// Upcoming one-off visits (PENDING or CONFIRMED, not yet started), not
// counting the visits of a standing appointment.
export const MAX_UPCOMING_BOOKINGS = 4

// Standing appointments still running (ACTIVE, end date not yet passed).
export const MAX_ACTIVE_STANDING_APPOINTMENTS = 1

// Longest standing appointment a customer can set up themselves. The salon's
// own cap (AppSettings.maxSeriesWeeks) still applies if it's shorter, and
// staff can book longer series for a customer.
export const CUSTOMER_MAX_SERIES_WEEKS = 12

export function customerMaxSeriesWeeks(salonMaxSeriesWeeks: number): number {
    return Math.min(salonMaxSeriesWeeks, CUSTOMER_MAX_SERIES_WEEKS)
}
