// How far ahead a recurring series gets materialized into real Appointment
// rows at creation time. A future scheduled job re-applies the same window
// on a rolling basis so indefinite series (no seriesEnd) keep getting new
// occurrences without ever storing an unbounded number of rows up front.
export const MATERIALIZE_WEEKS = 8;

// setDate (not raw ms arithmetic) so a week-boundary that crosses a DST
// transition still lands on the same local wall-clock time — adding
// 7*24*60*60*1000 ms would drift by an hour on that week.
function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
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
