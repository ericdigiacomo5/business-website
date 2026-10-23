// Run with `npm test`. The pure parts of texting: message wording and
// encoding, phone normalization, keywords, quiet hours and Twilio's
// signature check.

import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
    bookingConfirmationSms,
    cancellationSms,
    gsm7Segments,
    isWithinTextingHours,
    optInConfirmedSms,
    optInRequestSms,
    recurringCancelledSms,
    recurringConfirmationSms,
    reminderSms,
    rescheduleSms,
    shortLink,
    toGsm7,
} from "@/lib/sms-templates"
import { inboundKeyword, smsStatusOf } from "@/lib/sms-consent"
import { toUsE164 } from "@/lib/validation"
import { isValidTwilioSignature, twilioSignature } from "@/lib/twilio-signature"
import { SITE_NAME } from "@/lib/site"

// 10:00 AM on Thursday, Oct 22, 2026, in New York.
const START = new Date("2026-10-22T14:00:00Z")
const MANAGE = "https://nailimageinc.com/appointments"

const ALL_MESSAGES = [
    optInRequestSms(),
    optInConfirmedSms(),
    bookingConfirmationSms({ artistName: "Libby Bent", startTime: START, manageUrl: MANAGE }),
    rescheduleSms({ artistName: "Libby Bent", startTime: START, manageUrl: MANAGE }),
    reminderSms({ artistName: "Libby Bent", startTime: START, manageUrl: MANAGE }),
    cancellationSms({ artistName: "Libby Bent", startTime: START, cancelledBy: "salon" }),
    cancellationSms({ artistName: "Libby Bent", startTime: START, cancelledBy: "customer" }),
    recurringConfirmationSms({ artistName: "Libby Bent", firstStart: START, visits: 12, intervalWeeks: 2 }),
    recurringCancelledSms({ artistName: "Libby Bent", visits: 8 }),
]

test("every text names the business, says how to opt out, and fits one GSM-7 segment", () => {
    for (const message of ALL_MESSAGES) {
        assert.ok(message.startsWith(`${SITE_NAME}:`), message)
        assert.match(message, /STOP to opt out/, message)
        assert.equal(toGsm7(message), message, `not pure GSM-7: ${JSON.stringify(message)}`)
        assert.equal(gsm7Segments(message), 1, `${message.length} chars: ${message}`)
    }
})

test("the opt-in texts carry the carrier-required details", () => {
    for (const message of [optInRequestSms(), optInConfirmedSms()]) {
        assert.match(message, /Msg & data rates may apply/)
        assert.match(message, /HELP/)
        assert.match(message, /about 2 messages per booking/)
    }
    assert.match(optInRequestSms(), /Reply YES/)
})

test("times are the salon's, without Intl's narrow no-break space", () => {
    const message = bookingConfirmationSms({ artistName: "Libby Bent", startTime: START, manageUrl: MANAGE })
    assert.match(message, /Thu, Oct 22 at 10:00 AM/)
    assert.ok(!message.includes(" "))
    assert.match(message, /Manage: nailimageinc\.com\/appointments/)
})

test("a walk-in's texts have no link", () => {
    const message = reminderSms({ artistName: "Libby Bent", startTime: START, manageUrl: null })
    assert.ok(!message.includes("To change"))
    assert.equal(shortLink(null), null)
})

test("toGsm7 replaces typography, strips accents outside GSM-7, drops emoji", () => {
    assert.equal(toGsm7("It’s “great” – 10:00 AM"), `It's "great" - 10:00 AM`)
    assert.equal(toGsm7("José Núñez"), "José Nuñez") // é and ñ are GSM-7; ú isn't
    assert.equal(toGsm7("Nails 💅 done"), "Nails done")
    assert.equal(gsm7Segments("x".repeat(160)), 1)
    assert.equal(gsm7Segments("x".repeat(161)), 2)
    assert.equal(gsm7Segments("€".repeat(81)), 2) // extension characters count double
})

test("toUsE164 accepts US numbers in any format and refuses the rest", () => {
    assert.equal(toUsE164("(631) 555-0143"), "+16315550143")
    assert.equal(toUsE164("631.555.0143"), "+16315550143")
    assert.equal(toUsE164("+1 631 555 0143"), "+16315550143")
    assert.equal(toUsE164("16315550143"), "+16315550143")
    assert.equal(toUsE164("555-0143"), null) // no area code
    assert.equal(toUsE164("(131) 555-0143"), null) // area codes don't start with 1
    assert.equal(toUsE164("+44 20 7946 0958"), null)
    assert.equal(toUsE164("UNKNOWN"), null)
    assert.equal(toUsE164(null), null)
})

test("inboundKeyword trusts Twilio's OptOutType, then the body", () => {
    assert.equal(inboundKeyword("anything", "STOP"), "stop")
    assert.equal(inboundKeyword("anything", "START"), "start")
    assert.equal(inboundKeyword("", "HELP"), "help")
    assert.equal(inboundKeyword(" stop ", null), "stop")
    assert.equal(inboundKeyword("Unsubscribe", null), "stop")
    assert.equal(inboundKeyword("Yes!", null), "start")
    assert.equal(inboundKeyword("y", null), "start")
    assert.equal(inboundKeyword("help", null), "help")
    assert.equal(inboundKeyword("See you tomorrow", null), null)
    assert.equal(inboundKeyword("yes please stop", null), null) // only a bare keyword counts
})

test("smsStatusOf: texts are on only after the YES reply", () => {
    const phone = "+16315550143"
    assert.equal(smsStatusOf({ smsOptIn: false, smsPhone: null, smsConfirmedAt: null }), "off")
    assert.equal(smsStatusOf({ smsOptIn: false, smsPhone: phone, smsConfirmedAt: null }), "stopped")
    assert.equal(smsStatusOf({ smsOptIn: true, smsPhone: phone, smsConfirmedAt: null }), "waiting")
    assert.equal(smsStatusOf({ smsOptIn: true, smsPhone: phone, smsConfirmedAt: new Date() }), "on")
})

test("texting hours are 8 AM to 9 PM on the salon's clock", () => {
    assert.equal(isWithinTextingHours(new Date("2026-10-22T11:59:00Z")), false) // 7:59 AM EDT
    assert.equal(isWithinTextingHours(new Date("2026-10-22T12:00:00Z")), true) // 8:00 AM EDT
    assert.equal(isWithinTextingHours(new Date("2026-10-23T00:59:00Z")), true) // 8:59 PM EDT
    assert.equal(isWithinTextingHours(new Date("2026-10-23T01:00:00Z")), false) // 9:00 PM EDT
    assert.equal(isWithinTextingHours(new Date("2026-12-01T13:00:00Z")), true) // 8:00 AM EST
})

test("Twilio signatures match an independent HMAC-SHA1 and reject tampering", async () => {
    const token = "test-auth-token"
    const url = "https://nailimageinc.com/api/sms/inbound"
    const params = new URLSearchParams({ To: "+16315550199", From: "+16315550143", Body: "YES", MessageSid: "SM123" })

    // Twilio's documented algorithm, built separately with Node's crypto.
    const data = url + [...params.keys()].sort().map((k) => k + params.get(k)).join("")
    const expected = createHmac("sha1", token).update(data).digest("base64")

    assert.equal(await twilioSignature(token, url, params), expected)
    assert.equal(await isValidTwilioSignature(token, url, params, expected), true)
    assert.equal(await isValidTwilioSignature("wrong-token", url, params, expected), false)
    assert.equal(await isValidTwilioSignature(token, url + "?x=1", params, expected), false)
    const tampered = new URLSearchParams(params)
    tampered.set("Body", "STOP")
    assert.equal(await isValidTwilioSignature(token, url, tampered, expected), false)
    assert.equal(await isValidTwilioSignature(token, url, params, null), false)
})
