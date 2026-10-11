import { materializeAllSeries } from "@/lib/booking"
import { sendSkippedWeeksNotice } from "@/lib/appointment-emails"
import { requireJobSecret } from "@/lib/job-auth"

// Keeps every ACTIVE standing appointment booked MATERIALIZE_WEEKS ahead.
// Meant to run daily (the horizon is 8 weeks and the shortest interval is a
// week, so more often is harmless but pointless) — same "plain guarded route
// any scheduler can call" shape as /api/jobs/send-reminders. See
// PLAN_RECURRING_MATERIALIZATION.md.
//
// Deliberately NOT gated by the global self-booking toggle: that toggle stops
// *new* customer self-booking, and a standing appointment is a commitment
// that already exists.
export async function POST(request: Request) {
    const denied = await requireJobSecret(request)
    if (denied) return denied

    const result = await materializeAllSeries()

    // Routine extensions send nothing (each new week gets its 24h reminder).
    // Only weeks newly found to be unbookable are emailed — at most once per
    // week, since a skip is only "newly recorded" by the run that created it.
    // Awaited rather than after(): this isn't latency-sensitive, and the
    // scheduler's response should reflect a finished run.
    for (const series of result.results) {
        const newSkips = series.skipped.filter((s) => s.newlyRecorded)
        if (newSkips.length > 0) {
            await sendSkippedWeeksNotice(series.recurringAppointmentId, newSkips)
        }
    }

    return Response.json({
        data: {
            seriesProcessed: result.results.length,
            created: result.results.reduce((n, r) => n + r.created.length, 0),
            reactivated: result.results.reduce((n, r) => n + r.reactivated.length, 0),
            skipped: result.results.reduce((n, r) => n + r.skipped.length, 0),
            results: result.results,
            errors: result.errors,
        },
    })
}
