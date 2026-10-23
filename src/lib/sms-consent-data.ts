// SMS consent: the only code that changes a customer's texting fields
// (User.smsOptIn / smsPhone / smsConfirmedAt / smsConfirmRequestedAt), and
// it always writes a SmsConsentEvent in the same transaction, so the consent
// log can never disagree with the account. Server-only.
//
// The flow (double opt-in):
//   1. The customer ticks the box (register, or My Account) → OPTED_IN, for
//      the profile phone as it is now. One "Reply YES" text goes out.
//   2. They reply YES (or START) from that phone → Twilio's webhook →
//      CONFIRMED. Only now do appointment texts start.
//   3. Any of these turn texts off (OPTED_OUT): unticking the box or
//      changing the profile phone (both forget the number), and replying
//      STOP or Twilio refusing a send because the number opted out (both
//      keep the number: the account is "stopped", and texting START or YES
//      from that number turns texts back on, as the terms promise).
//
// The account states, as smsStatusOf() in sms-consent.ts reads them:
//   off      smsOptIn false, smsPhone null
//   stopped  smsOptIn false, smsPhone set (replied STOP)
//   waiting  smsOptIn true,  smsConfirmedAt null
//   on       smsOptIn true,  smsConfirmedAt set

import { prisma } from "@/lib/prisma"
import { toUsE164 } from "@/lib/validation"
import { SMS_CONSENT_VERSION } from "@/lib/sms-consent"

export type SmsOptInSource = "register" | "account"
export type SmsOptOutSource = "account" | "sms_reply" | "phone_changed" | "carrier"

const FORGET_FIELDS = { smsOptIn: false, smsPhone: null, smsConfirmedAt: null, smsConfirmRequestedAt: null } as const
const STOPPED_FIELDS = { smsOptIn: false, smsConfirmedAt: null, smsConfirmRequestedAt: null } as const

export type OptInResult =
    | { ok: true; alreadyOn: boolean }
    // no_phone: the profile phone isn't a US number texts can go to.
    // stopped: this number replied STOP, so the carrier blocks texts to it
    // until the customer texts START (or YES) to the salon's number — which
    // also turns texts back on here, with no box to tick.
    | { ok: false; reason: "no_phone" | "not_found" | "stopped" }

// Ticking the box. On success the caller schedules sendOptInRequest() with
// after() unless alreadyOn. Ticking it again while waiting for YES just
// re-sends the request (at most once a minute, see sendOptInRequest()).
export async function optInToSms(userId: string, source: SmsOptInSource): Promise<OptInResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, smsOptIn: true, smsPhone: true, smsConfirmedAt: true },
    })
    if (!user) return { ok: false, reason: "not_found" }

    const phone = toUsE164(user.phone)
    if (!phone) return { ok: false, reason: "no_phone" }

    if (user.smsPhone === phone) {
        if (user.smsOptIn) return { ok: true, alreadyOn: user.smsConfirmedAt !== null }
        return { ok: false, reason: "stopped" }
    }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { smsOptIn: true, smsPhone: phone, smsConfirmedAt: null, smsConfirmRequestedAt: null },
        }),
        prisma.smsConsentEvent.create({
            data: { userId, phone, action: "OPTED_IN", source, disclosureVersion: SMS_CONSENT_VERSION },
        }),
    ])
    return { ok: true, alreadyOn: false }
}

// Unticking the box, or the profile phone changing: texts stop and the
// number is forgotten. An OPTED_OUT event is logged only if texts were on
// (or waiting); a stopped account just forgets its number.
export async function optOutOfSms(userId: string, source: Extract<SmsOptOutSource, "account" | "phone_changed">): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { smsOptIn: true, smsPhone: true } })
    if (!user?.smsPhone) return

    if (!user.smsOptIn) {
        await prisma.user.update({ where: { id: userId }, data: FORGET_FIELDS })
        return
    }
    await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: FORGET_FIELDS }),
        prisma.smsConsentEvent.create({ data: { userId, phone: user.smsPhone, action: "OPTED_OUT", source } }),
    ])
}

// After a profile phone change (by the customer or by staff): consent was
// given for the old number, so texts stop until the box is ticked again for
// the new one. Pass the phone as saved.
export async function syncSmsWithPhone(userId: string, newPhone: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { smsPhone: true } })
    if (user?.smsPhone && toUsE164(newPhone) !== user.smsPhone) {
        await optOutOfSms(userId, "phone_changed")
    }
}

// A STOP reply, or Twilio refusing a send because the number opted out:
// every account texting that number stops (and keeps the number, so START
// can turn it back on).
export async function optOutPhone(phone: string, source: Extract<SmsOptOutSource, "sms_reply" | "carrier">): Promise<number> {
    const users = await prisma.user.findMany({ where: { smsPhone: phone, smsOptIn: true }, select: { id: true } })
    let stopped = 0
    for (const { id } of users) {
        await prisma.$transaction(async (tx) => {
            const changed = await tx.user.updateMany({ where: { id, smsPhone: phone, smsOptIn: true }, data: STOPPED_FIELDS })
            if (changed.count === 0) return
            await tx.smsConsentEvent.create({ data: { userId: id, phone, action: "OPTED_OUT", source } })
            stopped++
        })
    }
    return stopped
}

// A YES or START reply from `phone`. Confirms every account waiting on that
// number (the second half of the double opt-in), and turns texts back on for
// every account that stopped them from it by replying STOP. The number's
// owner texting the keyword is the consent; the event says it came by text.
// A number that no account opted in with gets nothing: replying YES alone
// isn't consent for an account that never asked.
export async function confirmPhone(phone: string): Promise<number> {
    const users = await prisma.user.findMany({
        where: { smsPhone: phone, smsConfirmedAt: null },
        select: { id: true, smsOptIn: true },
    })
    const now = new Date()
    let confirmed = 0
    for (const { id, smsOptIn: waiting } of users) {
        await prisma.$transaction(async (tx) => {
            const changed = await tx.user.updateMany({
                where: { id, smsPhone: phone, smsOptIn: waiting, smsConfirmedAt: null },
                data: { smsOptIn: true, smsConfirmedAt: now },
            })
            if (changed.count === 0) return
            if (!waiting) {
                await tx.smsConsentEvent.create({ data: { userId: id, phone, action: "OPTED_IN", source: "sms_reply" } })
            }
            await tx.smsConsentEvent.create({ data: { userId: id, phone, action: "CONFIRMED", source: "sms_reply" } })
            confirmed++
        })
    }
    return confirmed
}
