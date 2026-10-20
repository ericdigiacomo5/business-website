import { sendDueReminders } from "@/lib/appointment-emails"
import { requireJobSecret } from "@/lib/job-auth"
import { reportError } from "@/lib/report-error"

// Sends the 24h reminder email for every appointment that's due one. Meant to
// be hit on a schedule (hourly is plenty — a reminder then lands 23–24h
// ahead) by whatever scheduler the deploy ends up with: a Cloudflare Workers
// Cron Trigger, a GitHub Actions cron, or a third-party cron pinger. A plain
// guarded route rather than a Workers `scheduled()` handler on purpose — how
// a scheduled handler attaches to a Next.js deploy depends on the still-open
// vinext-vs-OpenNext adapter question (PROJECT_STATUS.md item 8), and this
// shouldn't be blocked on that.
//
// Safe to call repeatedly or concurrently — see sendDueReminders() for how
// double-sends are prevented.
export async function POST(request: Request) {
    const denied = await requireJobSecret(request)
    if (denied) return denied

    const result = await sendDueReminders()

    if (result.failed > 0) {
        await reportError({
            event: "reminders_failed",
            message: `${result.failed} of ${result.considered} reminder emails failed to send`,
            path: "/api/jobs/send-reminders",
        })
    }

    // Dead man's switch (docs/DEPLOY_RUNBOOK.md §11): a monitor such as
    // Healthchecks.io alerts when this ping stops arriving, which catches the
    // failure nothing above can — the scheduler itself never calling.
    const heartbeat = process.env.CRON_HEARTBEAT_URL
    if (heartbeat) {
        await fetch(heartbeat, { method: "POST" }).catch(() => undefined)
    }

    return Response.json({ data: result })
}
