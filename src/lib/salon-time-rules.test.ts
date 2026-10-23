// Run with `npm test`. Keeps the timezone fix from quietly coming undone:
// a Date's local fields (getHours, getDay, setDate, ...) and toLocale*String()
// without a timeZone use the *process's* zone, which is UTC on Workers and
// whatever the visitor's browser says on the client. Only salon-time.ts may
// touch them; everything else goes through its helpers (zonedParts,
// formatSalonDate, startOfDay, ...).

import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const SRC = path.join(process.cwd(), "src")
const ALLOWED = new Set([path.join("lib", "salon-time.ts")])

const FORBIDDEN: [RegExp, string][] = [
    [
        /\.(getHours|getMinutes|getSeconds|getDay|getDate|getMonth|getFullYear|getTimezoneOffset|setHours|setMinutes|setSeconds|setDate|setMonth|setFullYear)\(/,
        "reads or sets a Date's local fields",
    ],
    [/\.toLocale(Date|Time)?String\(/, "formats a date in the process's zone (use formatSalonDate/Time/DateTime)"],
    [/new Date\(\s*\d{4}\s*,/, "builds a Date from local calendar parts (use zonedToInstant or parseLocalDate)"],
]

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) return entry === "generated" ? [] : sourceFiles(full)
        return /\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") ? [full] : []
    })
}

test("only src/lib/salon-time.ts touches a Date's local-time fields", () => {
    const problems: string[] = []
    for (const file of sourceFiles(SRC)) {
        if (ALLOWED.has(path.relative(SRC, file))) continue
        const relative = path.relative(SRC, file).split(path.sep).join("/")
        readFileSync(file, "utf8")
            .split("\n")
            .forEach((line, index) => {
                for (const [pattern, why] of FORBIDDEN) {
                    if (pattern.test(line)) problems.push(`src/${relative}:${index + 1} ${why}: ${line.trim()}`)
                }
            })
    }
    assert.deepEqual(problems, [])
})
