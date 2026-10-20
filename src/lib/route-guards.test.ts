// Run with `npm test`. Mechanical guards for the rules this project's
// explicit-guard design depends on. A forgotten check is invisible in review
// and in the browser (SECURITY_AUDIT C1, 2026-10-18: the admin layout's
// check didn't stop pages streaming their data), so they're enforced here
// by reading the source.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const APP_DIR = path.join(process.cwd(), "src", "app")

function filesNamed(dir: string, name: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) return filesNamed(full, name)
        return entry === name ? [full] : []
    })
}

function relative(file: string): string {
    return path.relative(process.cwd(), file)
}

// Every `await <expression>` in the text, in order, as the text right after
// "await ".
function awaitsIn(source: string): string[] {
    return [...source.matchAll(/\bawait\s+([A-Za-z_][\w.]*)/g)].map((match) => match[1])
}

// Each exported route handler in a route.ts: its method and its source.
function handlersIn(source: string): { method: string; body: string }[] {
    return source
        .split(/export async function (?=GET|POST|PUT|PATCH|DELETE)/)
        .slice(1)
        .map((body) => ({ method: body.slice(0, body.indexOf("(")), body }))
}

// `await params` / `await searchParams` may come before the guard: reading
// the URL isn't reading data, and a page may need its own id to build the
// sign-in callback path.
const URL_INPUTS = new Set(["params", "searchParams"])

test("every admin page awaits requireAdminPage() before any other await", () => {
    const pages = filesNamed(path.join(APP_DIR, "admin"), "page.tsx")
    assert.ok(pages.length >= 11, `expected the admin pages, found ${pages.length}`)

    for (const page of pages) {
        const source = readFileSync(page, "utf8")
        const body = source.slice(source.indexOf("export default"))
        const firstDataAwait = awaitsIn(body).find((expression) => !URL_INPUTS.has(expression))
        assert.equal(firstDataAwait, "requireAdminPage", `${relative(page)}: the first await must be requireAdminPage(...)`)
    }
})

test("every /api/admin handler awaits requireAdmin() or requireAdminId() first", () => {
    const routes = filesNamed(path.join(APP_DIR, "api", "admin"), "route.ts")
    assert.ok(routes.length >= 20, `expected the admin routes, found ${routes.length}`)

    for (const route of routes) {
        const handlers = handlersIn(readFileSync(route, "utf8"))
        assert.ok(handlers.length > 0, `${relative(route)}: no handlers found`)

        for (const { method, body } of handlers) {
            const firstAwait = awaitsIn(body)[0]
            assert.ok(
                firstAwait === "requireAdmin" || firstAwait === "requireAdminId",
                `${relative(route)} ${method}: the first await must be the admin guard, got ${firstAwait}`,
            )
        }
    }
})

// CSRF (SECURITY_AUDIT L1): every mutating handler refuses cross-origin
// requests — through readJsonObject() (which also requires a JSON content
// type) or, for one without a body, rejectCrossOrigin().
// Exempt: Auth.js's own handlers (they check their own CSRF token) and the
// cron job route (Bearer secret, no cookies involved).
const CSRF_EXEMPT = new Set([
    path.join("auth", "[...nextauth]", "route.ts"),
    path.join("jobs", "send-reminders", "route.ts"),
])

test("every mutating API handler refuses cross-origin requests", () => {
    const apiDir = path.join(APP_DIR, "api")
    const routes = filesNamed(apiDir, "route.ts").filter((route) => !CSRF_EXEMPT.has(path.relative(apiDir, route)))

    for (const route of routes) {
        for (const { method, body } of handlersIn(readFileSync(route, "utf8"))) {
            if (method === "GET") continue
            assert.ok(
                /readJsonObject\(request\)|rejectCrossOrigin\(request\)/.test(body),
                `${relative(route)} ${method}: call readJsonObject(request) or rejectCrossOrigin(request)`,
            )
        }
    }
})
