import { prisma } from "@/lib/prisma"
import { errorMessage, reportError } from "@/lib/report-error"

// For an uptime monitor (docs/DEPLOY_RUNBOOK.md §11): 200 when the app can
// reach its database, 503 when it can't. Public and says nothing else —
// no versions, no error text — so it tells an outsider nothing useful.
export async function GET() {
    const headers = { "Cache-Control": "no-store" }

    try {
        await prisma.$queryRaw`SELECT 1`
        return Response.json({ data: { status: "ok" } }, { headers })
    } catch (error) {
        await reportError({ event: "health_check_failed", message: errorMessage(error), path: "/api/health" })
        return Response.json({ error: "Unavailable" }, { status: 503, headers })
    }
}
