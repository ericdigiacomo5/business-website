// The gift card terms, in one place, shown on the Terms page (§6) and
// printed on every gift card. NY General Business Law § 396-i(3) requires
// the terms (including any replacement procedure) to be printed on the card
// or with it, so the two must never differ. Client-safe (plain strings).
//
// Sources (see the comment at the top of src/app/terms/page.tsx): § 396-i
// for no expiry (5-a), no fees (5) and cash under $5 on request (5-b);
// common gift-card template clauses for "cannot be redeemed for cash" and
// "Treat your gift card like cash"; the replacement rule is how the app
// works (an unredeemed code can be voided and a new one issued).
//
// Changing them? Update TERMS_LAST_UPDATED in src/lib/site.ts. Cards
// already sold keep the terms they were printed with (§ 396-i forbids
// changing a card's terms after issue).

export const GIFT_CARD_TERMS = [
    "Gift cards do not expire, and no fees of any kind are charged on gift cards or store credit.",
    "A gift card is redeemed once, for its full value, onto your account, where it becomes store credit that can be used toward services in the salon.",
    "Gift cards and store credit cannot be redeemed for cash, except that a gift card with a remaining value of less than five dollars ($5.00) may be redeemed for its cash value on request, as New York law provides.",
    "Treat your gift card like cash. If a gift card is lost or stolen, we will replace it only if it has not yet been redeemed.",
] as const
