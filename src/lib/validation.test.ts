// Run with `npm test`. Pure helpers added by the 2026-10-18 security audit
// fixes (SECURITY_AUDIT.md).

import { test } from "node:test"
import assert from "node:assert/strict"
import { personNameError, requiredPersonName, safeCallbackUrl } from "@/lib/validation"
import { customerMaxSeriesWeeks, CUSTOMER_MAX_SERIES_WEEKS } from "@/lib/booking-limits"

test("requiredPersonName accepts real names", () => {
    for (const name of ["Jane Doe", "Mary-Kate O'Neil", "J.R. Smith", "St. John", "José Álvarez", "Dr. Ann Lee"]) {
        assert.equal(requiredPersonName(name), name, name)
    }
    assert.equal(requiredPersonName("  Jane  "), "Jane")
})

test("requiredPersonName refuses web and email addresses", () => {
    for (const name of [
        "Visit https://evil.example",
        "go to www.evil.net now",
        "write me: a@b.co",
        "Account locked, verify at evil.com",
        "claim refund at salon-help.xyz",
    ]) {
        assert.equal(requiredPersonName(name), null, name)
        assert.equal(personNameError(name), "Names can't contain web or email addresses")
    }
})

test("requiredPersonName refuses blank and overlong names, with the length message", () => {
    for (const value of ["", "   ", "x".repeat(101), 42, null]) {
        assert.equal(requiredPersonName(value), null)
        assert.match(personNameError(value), /Name is required/)
    }
})

test("customer standing appointments get the shorter of the two caps", () => {
    assert.equal(customerMaxSeriesWeeks(52), CUSTOMER_MAX_SERIES_WEEKS)
    assert.equal(customerMaxSeriesWeeks(8), 8)
})

test("safeCallbackUrl keeps same-site paths only", () => {
    assert.equal(safeCallbackUrl("/account"), "/account")
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "account", undefined]) {
        assert.equal(safeCallbackUrl(value), "/")
    }
})
