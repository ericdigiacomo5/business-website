// Server-side error reporting (FEATURE_GAPS.md Gap 26) — no vendor SDK, so
// nothing is added to the Workers bundle and nothing personal leaves the
// app by default.
//
// Every report is one JSON line on stderr, tagged "level":"error", which
// Cloudflare Workers Logs indexes and can alert on (docs/DEPLOY_RUNBOOK.md
// §11). If ERROR_ALERT_WEBHOOK_URL is set (a Slack or Discord incoming
// webhook), a short summary is also posted there, at most once per kind of
// error per 5 minutes per server instance, so a broken database doesn't
// send a message per request.
//
// Never throws: reporting a failure must not cause another one.

export type ErrorReport = {
    // A stable name for the kind of failure: "request_error",
    // "email_failed", "reminders_failed", …
    event: string
    message: string
    // Request path without its query string (query strings can carry
    // tokens), when there is one.
    path?: string
    method?: string
    // Next's route file path, e.g. /api/appointments/[id].
    routePath?: string
    // React/Next's error digest — matches the "digest" shown on the error
    // page, so a customer's screenshot can be found in the logs.
    digest?: string
}

const MAX_MESSAGE_LENGTH = 300
const ALERT_INTERVAL_MS = 5 * 60_000
const lastAlertAt = new Map<string, number>()

function stripQuery(path: string): string {
    const index = path.indexOf("?")
    return index === -1 ? path : path.slice(0, index)
}

export async function reportError(report: ErrorReport): Promise<void> {
    try {
        const entry = {
            level: "error",
            ...report,
            path: report.path ? stripQuery(report.path) : undefined,
            // One line: Prisma's messages start with blank lines and wrap.
            message: report.message.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH),
            at: new Date().toISOString(),
        }
        console.error(JSON.stringify(entry))

        const webhook = process.env.ERROR_ALERT_WEBHOOK_URL
        if (!webhook) return

        const key = `${entry.event}|${entry.routePath ?? entry.path ?? ""}`
        const now = Date.now()
        if (now - (lastAlertAt.get(key) ?? 0) < ALERT_INTERVAL_MS) return
        lastAlertAt.set(key, now)

        const where = entry.routePath ?? entry.path
        const summary = `[Nail Image] ${entry.event}${where ? ` at ${where}` : ""}: ${entry.message}${entry.digest ? ` (digest ${entry.digest})` : ""}`
        // `text` is what Slack reads, `content` what Discord reads.
        await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: summary, content: summary }),
        })
    } catch {
        // Nowhere left to report to.
    }
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
