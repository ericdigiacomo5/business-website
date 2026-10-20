import type { Instrumentation } from "next"
import { errorMessage, reportError } from "@/lib/report-error"

// Called by Next for every uncaught server error: a page or layout that
// threw while rendering, or a route handler that threw (e.g. the database
// was unreachable). Errors a route handles itself (a 400, a 409) never get
// here. See src/lib/report-error.ts for where reports go.
//
// Request headers are deliberately not reported: they carry the session
// cookie.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
    const digest =
        typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined

    await reportError({
        event: "request_error",
        message: errorMessage(error),
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        digest,
    })
}
