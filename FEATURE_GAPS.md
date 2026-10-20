# Feature Gap Analysis

**Project:** Nail salon booking platform (Next.js 16 App Router + TypeScript + Prisma + PostgreSQL/Neon + NextAuth v5)
**Analysis date:** 2026-09-23 (Gaps 1–21) · **Second review:** 2026-10-19 (Gaps 22–36 and the UI section)
**Reviewed commit:** `4a1ef82` (main) for the original audit; the second review read the working tree on top of `27d743c`, including the uncommitted 2026-10-19 security work
**Scope:** Product/feature completeness review — what a working salon still needs from the customer site and admin dashboard. Original audit: 27 API routes, 17 pages, 11 Prisma models. Second review: 56 route handlers, 23 pages, 25 models, plus the UI components, theme and email templates.
**Companion docs:** `SECURITY_AUDIT.md` covers security posture; this document covers functional gaps. `PROJECT_STATUS.md` is the current state and roadmap; `docs/PROJECT_HISTORY.md` is the archived build history.

> **Scope boundary:** this is about *missing capability*, not code quality or vulnerabilities. Several items here are small code changes with large operational consequences; severity below reflects **impact on a salon actually using this**, not implementation difficulty.

---

## Executive summary

> The summary and the individual findings below describe the state of the codebase **as of the original audit (2026-09-23, commit `4a1ef82`)** and are preserved as originally written — they are the record of what was missing and why it mattered, not a live description of current code. Check each gap's own **Status** line (in the table above, and at the top of its write-up) for what has since changed.

The scheduling engine is the hard part of this product and it is genuinely well built — double-booking is prevented by a database constraint rather than application logic, the booking race is handled explicitly, and authorization is enforced per-route without exception.

Nearly every gap below sits in the ring *around* that core, and they cluster into three themes:

1. **Nothing is ever communicated.** There is no email sending anywhere in the codebase — no booking confirmation, no reminder, no cancellation notice, no password reset. This is the root cause of the single worst customer-facing defect (permanent account lockout) and it is **not** blocked by the Twilio/SMS registration wait described in `PROJECT_STATUS.md` item 12.
2. **What already happened can't be recorded.** Walk-ins can't be entered after the fact, no-shows have no representation, and nothing can be rescheduled. The system models the future well and the past poorly.
3. **The captured data is never summarized.** Checkout now records payment method and timestamp, services carry prices — and there is not a single aggregate query in the codebase. The highest value-per-effort work on this list is reporting, because the data collection is already done.

### Findings at a glance

| # | Severity | Gap | Primary location | Status |
|---|----------|-----|------------------|--------|
| 1 | **BLOCKER** | No password reset — forgotten password = permanent lockout | `src/app/api/auth/` | **CLOSED** |
| 2 | **BLOCKER** | No email sending of any kind | *(absent codebase-wide)* | **CLOSED** — reminder job not yet scheduled (waits on deploy) |
| 3 | **BLOCKER** | Admins can't book in the past — walk-in revenue unrecordable | `src/app/api/appointments/route.ts` | **CLOSED** |
| 4 | **BLOCKER** | No reschedule — status is the only editable field | `src/app/api/admin/appointments/[id]/route.ts` | **CLOSED** |
| 5 | **BLOCKER** | No cancellation notice window | `src/app/api/appointments/[id]/route.ts` | **CLOSED** |
| 6 | **BLOCKER** | No salon-wide closure (holidays) | `prisma/schema.prisma` — `TimeOff` | **CLOSED** |
| 7 | **SHOULD** | No reporting/revenue view despite data being captured | *(absent)* | **Partial** (2026-10-18) — artist pay report built; daily takings / payment-method split still absent |
| 8 | **SHOULD** | No no-show tracking | `prisma/schema.prisma` — `AppointmentStatus` | **CLOSED** |
| 9 | **SHOULD** | No customer history view | `src/app/admin/users/` | **CLOSED** |
| 10 | **SHOULD** | No notes field anywhere (customer or appointment) | `prisma/schema.prisma` | Open |
| 11 | **SHOULD** | Standing appointments can be created but never managed | `src/lib/recurring.ts` | **CLOSED** |
| 12 | **SHOULD** | Artists can't log in — admin-only role model | `prisma/schema.prisma` — `Role` | Open |
| 13 | **SHOULD** | No rate limiting on public routes | *(absent)* | **Partial** — per-customer booking caps built (2026-10-19, `src/lib/booking-limits.ts`); request rate limits are Cloudflare edge rules in `docs/DEPLOY_RUNBOOK.md`, applied at deploy |
| 14 | **SHOULD** | Site never states address, hours, or phone | `src/app/about/page.tsx` | Open |
| 15 | NICE | Day view only — no week view | `src/app/admin/page.tsx` | **CLOSED** (2026-10-15) — week view per artist |
| 16 | NICE | Schedule never auto-refreshes | `src/components/admin/` | Open |
| 17 | NICE | Historical appointments show today's price | `prisma/schema.prisma` — `Appointment` | **CLOSED** (2026-10-13) — `AppointmentService` snapshots price + duration |
| 18 | NICE | No `error.tsx` / `not-found.tsx` / `loading.tsx` | `src/app/` | **CLOSED** (2026-10-16) — `error`, `global-error`, `not-found`; `loading` for admin + My Bookings |
| 19 | NICE | No per-page metadata, OG tags, sitemap, or structured data | `src/app/` | Open |
| 20 | NICE | Confirmation step is a dead end | `src/components/booking/steps/confirmed-step.tsx` | **Mostly closed** (2026-10-19, U7) — reference, add-to-calendar, policy, Book Again; address and phone show once `SALON_CONTACT` is filled in |
| 21 | NICE | No audit log | *(absent)* | Open |
| 22 | **SHOULD** | Time off or a closure over existing bookings doesn't flag them | `src/app/api/admin/time-off/route.ts` | **CLOSED** (2026-10-19) — confirmation lists the bookings; Go Back or Cancel All & Save |
| 23 | **SHOULD** | Every artist can be booked for every service | `prisma/schema.prisma` — `Artist`, `Service` | **CLOSED** (2026-10-19) — `ArtistService`; enforced for customers, admins warned |
| 24 | **SHOULD** | No "any artist / first available" choice when booking | `src/components/booking/steps/artist-step.tsx` | Open |
| 25 | **SHOULD** | No privacy policy or terms page | `src/app/` | **Planned** (2026-10-19) — plan below; blocked on client details and review |
| 26 | **SHOULD** | No error monitoring or uptime alerts | *(absent)* | **CLOSED in app** (2026-10-19) — error reports, `/api/health`, cron heartbeat; channel and monitors are set up at deploy (runbook §11) |
| 27 | NICE | No waitlist when the wanted day is full | *(absent)* | Open |
| 28 | NICE | Customer page has no summary stats or repeat no-show flag | `src/components/admin/users/admin-user-detail.tsx` | **CLOSED** (2026-10-19) |
| 29 | NICE | No "today at a glance" or pending-confirmation queue for staff | `src/app/admin/page.tsx` | Open |
| 30 | NICE | No "Book Again" from a past visit | `src/components/account/appointment-card.tsx` | Open |
| 31 | NICE | Nothing prompts renewal of an ending standing appointment | `src/lib/recurring.ts` | Open |
| 32 | NICE | No reviews, testimonials, or social links | `src/app/page.tsx`, `footer.tsx` | Open |
| 33 | NICE | Customers can't delete their account or download their data | `src/app/account/` | Open |
| 34 | NICE | Owner can't export customers or appointments | *(absent)* | Open |
| 35 | NICE | No analytics on the booking funnel | *(absent)* | Open |
| 36 | NICE | Accessibility gaps: no skip link, unlabeled step indicator, `window.confirm`, contrast | `src/app/layout.tsx`, `step-indicator.tsx`, `globals.css` | **CLOSED** (2026-10-19) — a full screen-reader pass is still worth doing |

All closed/partial gaps were verified live against the real dev database (not just typechecked or reasoned through) at the time each was fixed — the full build/verification account of each is in `docs/PROJECT_HISTORY.md` (the archived long-form `PROJECT_STATUS.md`). All six original blockers are closed (1–6). Of the "should have" findings, three more are also now closed (8, 9, 11), and of the "nice to have" findings, 15, 17 and 18 are closed. Gap 13 (rate limiting) is planned as Cloudflare edge rules, applied at deploy. **Still open, highest value first:** 7 (reporting), 14, 10, 12, 20, 19, 16, 21.

**2026-10-19 update.** Since the original audit the project has added gift cards and store credit, the artist pay report (the first slice of Gap 7), customer reschedule, email verification, booking caps (the in-app half of Gap 13) and a PWA. The second review found fifteen more gaps (22–36), and the new **UI and feel** section lists changes that would make the site feel more vibrant and easier to use. **Combined priority for the open items:** 14 + 25 (both needed before SMS registration), 22, 23, 7, 10, 24, 20, 26 (at deploy), then the UI quick wins U1–U4, then the rest.

**Later on 2026-10-19:** Gaps 22, 23, 28 and 36 were built and closed. So was the in-app half of 26; its alert channel and monitors are set up at deploy. Gap 25 has an implementation plan, waiting on the client. Each gap's own **Status** line says what was built and how it was verified. **Priority now:** 14 + 25, 7, 10, 24, 20, then U1–U4.

---

## Blockers

Each of these either costs money, traps a customer, or makes a normal salon policy unenforceable.

### Gap 1 — BLOCKER — A forgotten password locks a customer out permanently

**Status: CLOSED.** Full build and verification account is in `PROJECT_STATUS.md` under "Email + password reset," built from `PLAN_EMAIL_PASSWORD_RESET.md`. Summary: `POST /api/auth/forgot-password` / `POST /api/auth/reset-password`, a dedicated `PasswordResetToken` model (single-use, hashed, 15-minute expiry), and — the real subtlety — a `passwordChangedAt` field that gets checked in `src/auth.ts`'s existing per-request `jwt` callback, so a reset actually invalidates the attacker's live JWT session rather than just changing the password while their session keeps working.

**Location:** `src/app/api/auth/` contains only `[...nextauth]/` and `register/`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

There is no password reset flow: no "forgot password" link, no reset route, no reset-token model. A customer who forgets their password has no way back into their account and no way for the salon to help them — their booking history is simply inaccessible to them from then on.

Grep for `forgot` or `reset.*password` across `src/app/` returns nothing.

**Blocked by Gap 2** — a reset link has to arrive by email. These two should be done together, in that order.

---

### Gap 2 — BLOCKER — Nothing is ever emailed, including booking confirmations

**Status: CLOSED.** Full account in `PROJECT_STATUS.md` ("Email + password reset" and "Booking emails (Gap 2)"). `src/lib/email.ts` sends via Resend's REST API (raw `fetch()`, no SDK), with a console dev-driver when no API key is configured. Every consequence below now has an email: booking confirmation (one-off, plus one summary per standing appointment), 24h reminder, cancellation notice (customer- and salon-initiated), reschedule notice, standing-appointment pause/cancel notice, password reset, and a checkout receipt. **One remaining operational step:** the reminder job (`POST /api/jobs/send-reminders`, `CRON_SECRET`-guarded) is built and verified but nothing calls it on a schedule until deploy.

**Location:** absent codebase-wide

**Original finding, preserved for the record (describes the state before the fix, not current code):**

No mail library is installed (`nodemailer` / `resend` / `sendgrid` / `postmark` / `ses` all absent from `package.json`) and no sending code exists. `User.emailVerified` exists in the schema but is never written.

Consequences, in rough order of business impact:

- **No booking confirmation.** A customer books, sees a confirmation screen, closes the tab, and has no record to refer back to.
- **No reminder.** The day-before reminder is the single most effective no-show reduction in salon software, and it is the reason every comparable product (Square Appointments, Acuity, Vagaro) treats confirmation email as table stakes.
- **No cancellation notice.** If the salon cancels, the customer finds out by showing up.
- **No password reset** (Gap 1).
- **No receipt** after the checkout flow that was just built.

**Important sequencing note:** `PROJECT_STATUS.md` item 12 plans SMS confirmation/reminders via Twilio, blocked on 10–15 business days of A2P 10DLC campaign review plus a public deploy and privacy policy page. **Email has none of those dependencies.** It should not be sequenced behind SMS; if anything it reduces the urgency of SMS, since the two cover overlapping ground.

---

### Gap 3 — BLOCKER — Walk-ins can't be entered after the fact, so their revenue is never recorded

**Status: CLOSED**, on the second attempt. Full account in `PROJECT_STATUS.md` under "Admin past-time booking." Worth reading before touching related code: the first fix only relaxed the route's own `isInPast` check, which was necessary but not sufficient — `bookOccurrence()` calls `getOpenSlots()`, which had its own separate, unconditional past-time filter with no admin awareness, and silently defeated the first fix (confirmed live: an admin's past booking still failed with "That time is not available" after the supposed fix shipped). The real fix added an opt-in `allowPast` parameter to `getOpenSlots()` (default `false`, so the public unauthenticated availability route is untouched) and threaded it through both booking routes, including the recurring route's per-occurrence materialization loop and its series-start gate.

**Location:** `src/app/api/appointments/route.ts`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

The booking route rejects any start time in the past:

```ts
const isInPast = parsedStartTime.getTime() < Date.now()
if (isNaN(parsedStartTime.getTime()) || !isOnSlotGrid || isInPast) {
    return Response.json({ error: 'Time is invalid' }, { status: 400 })
}
```

This check sits **before** and independent of the `isAdmin` branch, so it applies to admins too. There is no admin bypass.

The operational consequence: someone walks in at 2pm and is served immediately. When the front desk goes to record it — at 2:30, or at close — the system refuses. There is no way to enter it at all, which means:

- The appointment never exists, so it never appears in the schedule history.
- **The sale is never captured.** This directly undercuts the checkout feature built on 2026-09-23 — a walk-in paid cash and that payment can never be recorded.

For a nail salon, where walk-ins are routine rather than exceptional, this is likely the largest single hole in the recorded takings. It is also among the smallest fixes on this list (exempt admins from `isInPast`, exactly as they are already exempted from the self-booking toggle on the lines just above).

---

### Gap 4 — BLOCKER — Appointments can't be rescheduled, only cancelled and rebooked

**Status: CLOSED.** Full build and verification account is in `PROJECT_STATUS.md`. Summary: admin-only, time-only, same-artist reschedule (a different artist or service is a deliberately separate, unscoped decision — see the discussion that scoped this). `PATCH /api/admin/appointments/[id]` now accepts an optional `startTime` alongside `status`, both independently optional and combinable in one request; the same transaction frees the appointment's old `AppointmentSlot` rows, re-validates the new time via `getOpenSlots`, and claims new slots, rolling back cleanly on a genuine conflict (verified live). The admin schedule UI reuses the customer booking wizard's own date/time picker (`DateTimeStep`) inside `ScheduleDetailSheet`, with a new `excludeAppointmentId` parameter on `GET /api/artists/:id/availability` (admin-only, silently ignored for anyone else) so the picker doesn't falsely show the appointment's own current slot as unavailable.

**Location:** `src/app/api/admin/appointments/[id]/route.ts`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

`PATCH` accepts only `status` (plus `paymentMethod` when completing) and explicitly rejects every other field. `src/app/api/admin/appointments/route.ts` is GET-only. On the frontend, `ScheduleBlock` is a plain click-to-select `<button>` — no drag handlers, no resize, no edit form.

So there is no way to move a booking to a different time, artist, or service. "Can I come in an hour later?" is one of the most common calls a salon takes, and today the only answer is cancel-and-rebook, which loses the original booking's identity and risks the slot being claimed in between.

`PROJECT_STATUS.md` records this deferral deliberately (reschedule would desync `AppointmentSlot` rows tied to the original `slotStart`), and that reasoning is sound — but the feature is a genuine operational requirement, not a nice-to-have. The implementation shape is already established: free the old slots and claim the new ones in one transaction, the same pattern `POST /api/appointments` already uses.

---

### Gap 5 — BLOCKER — Customers can cancel at any time, including after the appointment

**Status: CLOSED.** Full account in `PROJECT_STATUS.md`. `DELETE /api/appointments/[id]` now rejects cancelling any appointment whose `startTime` is less than 24 hours away, and separately rejects cancelling one already in a terminal state (`CANCELLED`/`COMPLETED`) regardless of timing — together these close all three bullets in the original finding below: "cancel five minutes before" (the 24h check), "cancel one that already happened" (a past `startTime` is always inside the 24h-out window, caught by the same check with no separate past-time branch needed), and "re-cancel one that is already `CANCELLED` or `COMPLETED`" (the status check, added in a follow-up pass after the 24h check alone was shipped and found to still let a far-future terminal-status appointment through). The admin-vs-customer scoping question this gap's fix required got resolved along the way: this route only ever cancels the caller's *own* appointment, so it needs no admin-awareness at all — an admin acting on someone else's behalf already goes through the separate `PATCH /api/admin/appointments/[id]`, which correctly has no notice-window restriction.

**Location:** `src/app/api/appointments/[id]/route.ts`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

The DELETE handler enforces exactly two rules: the caller is signed in, and the appointment is theirs. There is no check on timing or current status. A customer can therefore:

- Cancel five minutes before their appointment,
- Cancel an appointment that already happened,
- Re-cancel one that is already `CANCELLED` or `COMPLETED`.

The standard salon policy — 24 or 48 hours' notice — cannot be expressed anywhere in the system.

The UI does hide the button appropriately, but this is explicitly cosmetic. From `src/components/account/my-bookings-list.tsx:9`:

```ts
// The DELETE route itself doesn't block cancelling a past/inactive
// appointment — this is a frontend-only UX guard, not a security boundary.
```

Note this also interacts with Gap 11: cancelling one materialized occurrence of a standing appointment does not touch the parent `RecurringAppointment`, so nothing prevents the series from re-materializing it. (Also still true after the fix — unaffected.) **Addressed by design in the planned rolling-materialization job** (`PROJECT_STATUS.md` Roadmap item 15 / `PLAN_RECURRING_MATERIALIZATION.md`): each occurrence gets a stable `occurrenceDate` identity, and any existing row not freed by a series-level pause/cancel — including an individually cancelled one — counts as already handled, so the job never re-creates it.

---

### Gap 6 — BLOCKER — The salon can't close for a holiday

**Status: CLOSED.** Full account in `PROJECT_STATUS.md`; the design decision behind it is in `PLAN_SALON_CLOSURES.md`. Summary: `TimeOff.artistId` is now nullable (`null` = salon-wide, blocking every artist including ones created after the row exists) and `TimeOff.endDate` is new and nullable (a value makes it a `[date, endDate]` inclusive multi-day range). This was chosen over Eric's initial idea of a list of artist ids on `TimeOff`, which was rejected for two reasons worth remembering if the topic resurfaces: a list has to be re-populated by hand every time staff changes (the nullable design instead covers everyone with zero maintenance), and it wouldn't have touched the date-range half of this finding at all.

**Location:** `prisma/schema.prisma` — `TimeOff`, `AppSettings`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

`TimeOff.artistId` is a non-nullable foreign key and `TimeOff.date` is a single date, so time off is strictly per-artist, per-day. Closing for Thanksgiving means manually adding one row per artist for that date; a multi-day closure multiplies that again, since there is no date range.

`AppSettings` holds exactly one field:

```prisma
model AppSettings {
  id             Int     @id @default(1)
  bookingEnabled Boolean @default(true)
}
```

The only blunt alternative — flipping `bookingEnabled` off — closes online booking for *every* future date, not just the holiday.

Two things are missing: a salon-level closure (no `artistId`), and a date range rather than a single date. Both are additive schema changes; the read path in `src/lib/availability.ts` already treats time off as blocked ranges and would need only to include salon-wide rows.

---

## Should have

Daily friction at the front desk, and questions the owner currently has no way to answer.

### Gap 7 — SHOULD — No reporting at all, despite the data being captured

**Status: PARTIAL (2026-10-18).** The artist pay report (`/admin/reports/pay`, steps 1–3 of `PLAN_ARTIST_PAY_REPORT.md`) is the first aggregate view: sales by artist, category and service over any date range, with commission and fees. **Still missing:** what this finding asked for first, the owner's daily takings with the cash / card / Groupon / other split (for reconciling with the POS at close), plus no-show and cancellation rates, busiest hours, new vs. returning customers, and store credit / gift card liability over time. `pay-report-data.ts` already loads completed visits by date range, so a "Daily Takings" sheet can reuse that query and group by `paymentMethod`.

**Location:** absent

There is no revenue view, no daily takings, no payment-method breakdown, no per-artist performance, and no busiest-hours analysis. Grep for `revenue|analytics|groupBy|_sum|_count|aggregate` outside `src/generated/` returns **zero matches**. Price appears in the UI only as a single appointment's formatted value.

The notable part is that **the collection work is already done**: `Appointment.paymentMethod`, `Appointment.checkedOutAt`, and `Service.priceCents` are all populated. "What did we take last week, and how much of it was cash?" is one `groupBy` away — it simply has no screen.

This is the highest value-per-effort item in this document. **Do Gap 17 (price snapshot) first**, or the reports will be quietly wrong the moment a price changes.

---

### Gap 8 — SHOULD — No no-show tracking

**Status: CLOSED.** Full account in `PROJECT_STATUS.md` under "No-show tracking (Gap 8) and admin customer history (Gap 9)," built together with Gap 9. Summary: `NO_SHOW` added to `AppointmentStatus` via a hand-written `ALTER TYPE ... ADD VALUE` migration (`20260925010000_add_no_show_status`), following the exact precedent this finding named. `PATCH /api/admin/appointments/[id]` frees the appointment's slots on a transition to `NO_SHOW` the same way it already did for `CANCELLED` — the two remain genuinely distinct statuses (not folded together) so a salon can tell "cancelled politely" apart from "didn't show," which is the actual point of the gap. The admin schedule UI (`ScheduleDetailSheet`) gained a "No-Show" action, offered only on a `CONFIRMED` appointment (an unconfirmed one is more naturally just cancelled).

**A real bug this feature exposed, found and fixed in the same session (see "Follow-up fix" under Gap 8/9 in `PROJECT_STATUS.md`):** since `NO_SHOW` frees its slot the same as `CANCELLED`, the same artist+time can be legitimately rebooked afterward — and the admin schedule grid had no collision handling, so a terminal appointment and the live one that reused its slot rendered as two blocks stacked in the same grid cell, one invisibly hiding the other. Fixed by excluding `CANCELLED`/`NO_SHOW` from the grid's default (no-filter) view — the existing status filter still surfaces them on request, scoped to just that status so there's no overlap to hide behind.

**Location:** `prisma/schema.prisma` — `AppointmentStatus`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

The enum is `UPCOMING | CONFIRMED | CANCELLED | COMPLETED`. A customer who simply doesn't turn up must be recorded as one of these — in practice `CANCELLED`, which makes them indistinguishable from someone who called ahead to cancel politely.

Salons track no-shows because repeat offenders inform real decisions: requiring a deposit, or declining to book them. Adding a `NO_SHOW` value is a small enum migration (and there is precedent — `PENDING` → `UPCOMING` was handled with a hand-written `ALTER TYPE` migration); the value comes from surfacing it in Gaps 7 and 9.

**Not addressed, carried forward:** Gap 7 (reporting) still doesn't exist, so no-show *counts* per customer aren't surfaced anywhere yet — this gap only closed the data model and the ability to record one, not the aggregate view Gap 7 would build on top of it.

---

### Gap 9 — SHOULD — No customer history view

**Status: CLOSED.** Full account in `PROJECT_STATUS.md` under "No-show tracking (Gap 8) and admin customer history (Gap 9)," built together with Gap 8. Summary: new `/admin/users/[id]` Server Component detail page, direct-Prisma read of the user plus their appointments (`orderBy: startTime desc` — most recent first). Inline editing moved from the list row (removed entirely) to this page, reusing the same `PATCH /api/admin/users/[id]` route that already existed and already excluded `passwordHash`. `AdminUserRow` in the list is now a plain link, not an editable row.

**Location:** `src/app/admin/users/`

**Original finding, preserved for the record (describes the state before the fix, not current code):**

The users page is a flat, searchable list showing name, email, phone, and role. There is no `/admin/users/[id]` detail page, and `GET /api/admin/users/[id]` never queries `appointment`.

So there is no way to see a customer's past appointments, lifetime spend, usual artist, no-show count, or notes. "What did she have last time, and who did it?" is a question asked before nearly every returning client, and answering it today means scrolling the schedule by hand.

**Not addressed, carried forward:** lifetime spend, usual artist, and no-show count are not computed/surfaced as summary stats on the new page — it lists raw appointment history (which does let someone answer "what did she have last time" by reading the top row), but doesn't aggregate it. Notes (Gap 10) are also still absent. Both are natural follow-ups to layer onto this same page rather than reasons this gap remains open — the finding was specifically "no view at all," which is now fixed.

---

### Gap 10 — SHOULD — Nowhere to write anything down

**Location:** `prisma/schema.prisma` — `Appointment`, `User`

No notes field exists on either model. There is no way to record:

- Clinical/safety detail — "allergic to acetone," "nail biter, keep it short"
- Preference — "same colour as last time," "prefers Barbara"
- Operational — "called ahead, running 10 min late"

Customers also have no way to add a request when booking; the review step has no free-text field.

Two small additions cover nearly all real use: a customer-supplied note captured at booking, and a staff-only note on the appointment (or on the user, for standing preferences). Keep them separate — customers should not see staff notes.

---

### Gap 11 — SHOULD — Standing appointments can be created but never managed

**Status: CLOSED.** Full account in `PROJECT_STATUS.md` under "Recurring appointment management (Gap 11)"; the design is written up in `PLAN_RECURRING_MANAGEMENT.md` (gitignored — local planning doc, not checked in). Summary: `PATCH` routes for both admin (`/api/admin/recurring-appointments/[id]`) and the owning customer (`/api/recurring-appointments/[id]`) now write `RecurringStatus`, sharing one transaction (`applyRecurringStatusChange()` in `src/lib/booking.ts`) that also frees the series' future `UPCOMING`/`CONFIRMED` occurrences on Pause/Cancel — without that cascade, flipping the status alone would do nothing visible on the schedule for up to 8 weeks. A `respectNoticeWindow` flag is the one behavioral difference between the two callers: a customer's own cancel/pause leaves any occurrence less than 24h out untouched, same policy as cancelling one directly; an admin has no such restriction. Two admin surfaces: a new dedicated `/admin/recurring` page (salon-wide, filterable by status/artist — the thing no prior view could answer without opening every customer one at a time) and a `userId`-scoped section on the existing `/admin/users/[id]` page. A new customer-facing "Standing Appointments" section was added to `/appointments` too — Resume is hidden there specifically (via a `RecurringSeriesRow` `allowResume` prop), since resuming a paused series doesn't re-materialize anything until the still-unbuilt rolling re-materialization job exists, and a customer has no context for why that's incomplete the way an admin does. Single-occurrence cancellation (`DELETE /api/appointments/[id]`, the admin appointment `PATCH`) was deliberately left untouched — "skip this one" and "end the whole series" are different intents that shouldn't be conflated into one button.

**A real RSC-boundary bug found and fixed while building this, the second instance of the same failure mode this project has now hit** (the first is documented under Gap 6's "Salon-wide closures" write-up): `src/lib/recurring.ts` is imported by a Client Component (`review-step.tsx`, for the `MATERIALIZE_WEEKS` constant), so adding a `prisma` import to that file for the new shared transaction broke the browser bundle outright (`Module not found: Can't resolve 'net'`, from `pg` being pulled in transitively) — confirmed live via a real `500` on `/admin/book` before the fix. Moved the transaction to `src/lib/booking.ts` (server-only, no client consumers) instead. Hit the *identical* class of bug a second time in the same session: `RecurringSeriesRow` (shared with customer-facing UI) imported `timeStringToDate` from `src/lib/availability.ts`, which also pulls in Prisma — broke `/admin/recurring` the same way. Fixed by moving `timeStringToDate` into the already-existing `src/lib/schedule-grid.ts` (the "pure, DB-free" sibling file `availability.ts`'s own header comment already documents as the pattern for exactly this situation), re-exported from `availability.ts` for server callers. Worth remembering as a recurring failure shape in this codebase: a shared `src/lib/*.ts` module used by both server and client code can be silently poisoned by *any* transitive Prisma import, not just a direct one — the fix is always the same (split the client-safe pieces into their own file), and this project now has three files following that split (`schedule-grid.ts`/`availability.ts`, plus the `time-off.ts` sentinel fix from Gap 6).

**Verified live** against the real dev database: admin `GET` (unfiltered salon-wide, `userId`-scoped, `status`-filtered) and `PATCH` (Pause frees future occurrences and confirmed via `getOpenSlots` that the slot reopens; Resume correctly freed zero occurrences and did not re-create the paused-and-freed slot, confirming no re-materialization happens; Cancel; unknown-id `404`; invalid-status `400`; unauthenticated `401`) all confirmed via direct API calls. Customer self-service verified with a real registered account: `GET` own series, `PATCH` own series (pause/cancel), and a `403` confirmed when attempting to `PATCH` a different customer's series by id. The notice-window behavior specifically verified with a dedicated near-term fixture (an occurrence booked ~2 hours out): the customer's own cancel correctly froze the series but left that one imminent occurrence `UPCOMING` and unfreed, while a subsequent admin cancel of the same (already-cancelled) series correctly freed it — proving the two paths' notice-window policies are genuinely independent, not just differently worded. Browser verification (Playwright, `--no-save`, `try/finally`-wrapped, fully uninstalled afterward) confirmed all three UI surfaces render and mutate correctly with zero console errors: the dedicated admin page (customer name shown, Pause/Cancel with the inline confirmation swap, status badges updating in place), the per-customer secondary view (same series visible, status persisted across navigating between the two admin surfaces), and the customer's own account page (series visible, own name/email correctly never rendered on their own row, Resume button correctly absent on a paused series, "contact the salon" copy shown instead). All disposable test artists created during this and prior sessions' verification were confirmed deactivated afterward (a stray one from an earlier session's Playwright run had been left `active: true` — found via a direct `GET /api/artists` check and fixed, rather than assumed clean).

Both customers and admins can create a recurring series, and the schema supports pausing or ending one:

```prisma
enum RecurringStatus { ACTIVE  PAUSED  CANCELLED }
```

But **no route and no screen references `PAUSED` or `CANCELLED`.** Once a standing appointment exists, nobody — customer or admin — can view the series, pause it, or end it. It keeps materializing every `MATERIALIZE_WEEKS = 8`.

Compounding it, cancelling a single occurrence doesn't touch the parent series, so the cancelled slot can silently reappear on the next materialization.

This is a **half-finished feature rather than a missing one**, which makes it more urgent than its severity implies — it's currently possible to create something the system gives you no way to stop.

---

### Gap 12 — SHOULD — Artists can't log in to see their own schedule

**Location:** `prisma/schema.prisma` — `Role`, `Artist`

`Artist` and `User` are entirely unrelated models — `Artist` has no `userId`, no email, no password. The role enum is `CUSTOMER | ADMIN` with nothing in between, and `requireAdmin()` is all-or-nothing.

The practical result: the only way a nail tech sees their own day is being handed the owner's admin login, which also grants pricing control, global settings, and every other customer's contact details.

The conventional answer is a staff role scoped to its own artist column — read-only on the schedule, no access to services, settings, or other artists' clients. This is also the most interesting permission-design problem left in the project, which makes it worth building deliberately rather than minimally.

---

### Gap 13 — SHOULD — No rate limiting or abuse protection on public routes

**Status: PARTIAL.** Request rate limits are planned (2026-10-16) as Cloudflare edge (WAF) rules rather than app code; the exact rules are in `docs/DEPLOY_RUNBOOK.md` and get applied when the site deploys. Until then there is no request limit. The booking-inventory half below is **closed** (2026-10-19): `src/lib/booking-limits.ts` caps a customer at 4 upcoming one-off bookings, 1 active standing appointment and a 12-week series, and bookings are limited to 14 days ahead. One known gap: the caps are count-then-book, so two simultaneous requests can exceed a cap by one.

**Location:** absent

Grep for `rate|ratelimit|throttle|captcha|turnstile|recaptcha|honeypot` across `src/` returns nothing, and there is no `middleware.ts` / `proxy.ts`.

- `POST /api/auth/register` is unthrottled — a script can create unlimited accounts.
- `POST /api/appointments` requires a session but has no per-user booking cap, no maximum appointments per day, and no booking-horizon limit. One authenticated account can mass-book the entire calendar.

The booking cap is arguably the more pressing of the two, since it's a denial-of-service against the salon's actual inventory rather than just junk rows.

> **Already decided, not a gap:** registration returning `409` for an existing email (user enumeration) was reviewed in `SECURITY_AUDIT.md` Finding 7 and **deliberately accepted** as the standard signup trade-off. The timing channel — the genuinely important half — is correctly closed. Not re-raised here.

---

### Gap 14 — SHOULD — The site never says where the salon is or when it's open

**Location:** `src/app/about/page.tsx`

There is no address, phone number, opening hours, or map anywhere on the site. The About page is two paragraphs of placeholder copy about the booking experience. For a local business, this is the information most visitors arrive looking for — and the absence of a phone number is conspicuous given the same page tells customers there are "no phone calls."

This also has a downstream dependency: the A2P 10DLC registration in `PROJECT_STATUS.md` item 12 requires a publicly reachable site showing business identity **and** a privacy policy page. Neither exists. Since that registration is the long pole on SMS, this is worth doing early even though it's small.

---

## Nice to have

Real improvements, safely deferred.

### Gap 15 — NICE — Day view only, no week view

**Status: CLOSED (2026-10-15).** `/admin?view=week` shows one artist Sunday–Saturday; the day view is unchanged.

The schedule shows one day, stepped with prev/next buttons (`src/lib/schedule-grid.ts`; the query is bounded `startOfDay`/`endOfDay`). Planning staffing or spotting a quiet afternoon means clicking day by day. A week view is the default in most salon software for that reason.

Note the grid bounds derive from `Availability` rows only and never consider appointments — so an appointment outside configured hours (which Gap 3's fix could introduce) would compute an out-of-range grid row.

### Gap 16 — NICE — The schedule never refreshes on its own

No `router.refresh()`, `setInterval`, `EventSource`, or `WebSocket` anywhere in `src/components/admin/`. The grid is a snapshot from page load, and mutations update local state only.

If a customer books online while the front desk has the dashboard open, it won't appear until someone manually reloads. Two staff on two devices will silently disagree about the day's schedule. A periodic `router.refresh()` is the cheap fix.

### Gap 17 — NICE — Historical appointments show today's price

**Status: CLOSED (2026-10-13).** Part of the multi-service work: each `AppointmentService` line stores the `priceCents` and `durationMinutes` it was booked at, so repricing a service no longer changes past appointments or receipts.

`Appointment` has no price field — price is read live from the related `Service`. Raising a manicure from $45 to $50 retroactively rewrites **every past appointment** to $50, including ones already checked out and paid at the old price.

Severity is "nice" only because nothing currently reports on price. **It becomes a correctness blocker the moment Gap 7 is built**, so snapshot `priceCents` onto `Appointment` at booking time *before* the reporting work, not after.

### Gap 18 — NICE — No error, not-found, or loading pages

**Status: CLOSED (2026-10-16).** Root `src/app/not-found.tsx` (branded 404, with links home and to booking), `src/app/error.tsx` (retry + home) and `src/app/global-error.tsx` (errors in the root layout itself). `loading.tsx` added for `/admin` and `/appointments` only — deliberately not at the root, because a streamed response is fixed at HTTP 200, which would turn public 404s into "soft 404s".

The only special files in `src/app/**` are `layout.tsx` and `admin/layout.tsx`. There is no `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx` anywhere.

An unhandled server error shows the raw Next.js default page, and `src/app/artists/[id]/page.tsx` calls `notFound()` but falls through to the built-in 404 with no branding and no route back into the site.

### Gap 19 — NICE — Invisible to search engines and link previews

The only metadata in the app is the root `layout.tsx` export (`{ title: SITE_NAME, description: SITE_TAGLINE }`). No page exports `metadata` or `generateMetadata`, so `/services`, `/artists`, `/artists/[id]`, `/about`, and `/book` all share one generic title.

Also absent: `openGraph` and `twitter` tags (a link shared to Instagram or a group chat shows no image or description), `metadataBase`, canonical URLs, `robots.txt`, `sitemap.xml`, and LocalBusiness JSON-LD — the last being what surfaces hours and location directly in Google results, which pairs with Gap 14.

### Gap 20 — NICE — The booking confirmation is a dead end

`confirmed-step.tsx` shows service, artist, and first date, plus recurring created/skipped counts. It does not show a booking reference, an add-to-calendar link, the salon address or parking note, the cancellation policy, or a contact number.

Add-to-calendar is a few lines (an `.ics` data URI or Google Calendar link) and measurably reduces no-shows.

### Gap 21 — NICE — No record of who changed what

There is no `AuditLog` model, no `updatedAt` on `Appointment` / `Artist` / `Service` / `Availability` / `TimeOff`, and no actor recorded on any mutation. `checkedOutAt` is the only "when" in the schema and it records no "who."

A customer-initiated cancellation is indistinguishable from an admin one. This matters more once more than one person has admin access — i.e. it pairs with Gap 12.

---

## Second review (2026-10-19) — should have

These describe the code as of 2026-10-19.

### Gap 22 — SHOULD — Adding time off over existing bookings doesn't flag them

**Status: CLOSED (2026-10-19).** Saving time off (create or edit, per-artist or salon-wide) that lands on live bookings is refused with `409` and the list, and the admin sees a confirmation (`time-off-conflicts-dialog.tsx`) naming each booking: time, customer, services, and the artist for salon-wide entries. **Go Back** (focused by default; Escape too) returns to the form with everything as typed, and nothing is saved. **Cancel All & Save** re-sends with those ids approved; the server cancels them (soft cancel, slots freed) and saves the time off in one transaction, then emails each customer the salon-worded cancellation in `after()`. The design is in `src/lib/time-off-conflicts.ts`:

- Conflicts are re-found **inside** the transaction, so the list acted on is the current one. A booking made after the admin opened the confirmation isn't cancelled; it comes back as a new `409` for them to see. Approved ids that no longer conflict are skipped.
- Only bookings that haven't ended count. A visit that's already over (waiting for checkout, or a no-show) is never cancelled by adding time off.
- The read inside the transaction is a flat query. Prisma reads relations with parallel queries, and on a transaction's single connection that triggers `pg`'s "already executing a query" deprecation (it will break in pg@9). Verification caught this; the confirmation's display details are loaded after the transaction.

**Verified** against a production build: 18 API checks (refusal, nothing saved, wrong or malformed approval, adjacent time off unaffected, salon-wide, approved cancel + slots freed + email attempted, PATCH widening refused then approved, past visit ignored) and 10 browser checks at 375px (dialog contents, focus, Escape, Go Back keeps the form's values and saves nothing, Cancel It & Save, notice, booking cancelled, row saved). The existing "Adding time off … doesn't cancel or flag it" limitation in `PROJECT_STATUS.md` is gone.

**Location:** `src/app/api/admin/time-off/route.ts`, `src/lib/availability.ts`

`POST /api/admin/time-off` never looks at appointments (the route has no reference to them). Time off blocks *new* bookings, but a customer already booked into that day keeps a `CONFIRMED` appointment and gets no email. `PROJECT_STATUS.md` lists this as an accepted limitation; it's a gap because a salon-wide holiday closure (Gap 6) is the most common reason to add time off, and the failure mode is a customer standing at a locked door.

**Suggested shape:** before saving, count live (`PENDING`/`CONFIRMED`) appointments in the range and return them. The UI shows "3 bookings fall in this time off," with links to each, plus an optional "Cancel them and email the customers" that runs the existing salon-worded cancellation path. Never cancel silently.

### Gap 23 — SHOULD — Every artist can be booked for every service

**Status: CLOSED (2026-10-19).** Migration `20261020013553_add_artist_services` (applied to dev; additive: one join table `ArtistService`, cascading FKs, nothing changed on existing tables; the SQL matched Prisma's own diff exactly). **No rows = every service**, so every existing artist works unchanged and a service added later is bookable with "every service" artists without anyone remembering to tick it. Pieces:

- **Rules** in `src/lib/artist-services.ts` (pure, unit-tested) and `src/lib/artist-services-data.ts` (server: `setArtistServices()`, `artistServicesError()`).
- **Enforced for customers** in both booking routes (`400` "Libby doesn't do Wax. Please choose another artist."). **Admins may override.** The schedule's booking sheet marks the artist's other services "Not usually done by …" but leaves them selectable. Customer reschedules keep the same services, so they need no check.
- **Wizard:** the artist step lists only artists who do every chosen service (with a message when none do). Arriving from an artist's page marks the services they don't do. A deep link or a restored selection with an incompatible artist drops the artist.
- **Admin Artists page:** "Services They Do": *Every service* or *Only some* with checkboxes (retired services shown, marked). "Only some" with nothing ticked is refused rather than silently meaning "every service". The card shows "Does every service" or "Does: …".
- The public `GET /api/artists` is unchanged.

**Verified:** 16 API checks (customer refused one-off, mixed and standing; allowed for an offered service; admin override; unknown id `404` with rollback; malformed `400`; POST with a list; reset with `null`; no pay data in public responses; lookups shipped to `/book` and the schedule) and 12 browser checks at 375px (artist form both modes and the empty-list refusal, card text, wizard marking and filtering both ways, booking-sheet warning).

**Location:** `prisma/schema.prisma` — `Artist`, `Service` (no relation between them)

The availability engine treats every active artist as able to do every active service, so a customer can book a wax with an artist who only does nails. Salons nearly always have some specialization. Booking caps, the pay report and the wizard all assume this is fine, and it's cheap to fix now and expensive later.

**Suggested shape:** an `ArtistService` join table (no rows = "does everything," so nothing breaks on migration). The artist step filters to artists who do *all* the chosen services, and the admin booking sheet warns but allows an override.

### Gap 24 — SHOULD — No "any artist / first available" choice

**Location:** `src/components/booking/steps/artist-step.tsx`, `src/lib/availability.ts`

The wizard requires picking an artist before any times appear. Many customers don't care who does their manicure, and they're the ones most likely to leave when the first artist they try has nothing open. "Any artist" would merge every eligible artist's open slots (respecting Gap 23) and assign one at booking. The `@@unique([artistId, slotStart])` claim still decides the race, so the double-booking guarantee doesn't change.

### Gap 25 — SHOULD — No privacy policy or terms page

**Status: PLANNED (2026-10-19)** — the plan is below. The code is about half a day; the text needs the client's details and their review, and that's the long pole.

**Location:** `src/app/` (no `privacy`/`terms` routes; nothing links to one)

The site collects names, emails and phone numbers and sends transactional email. A privacy policy is (a) table stakes for any site holding personal data, (b) **required for the A2P 10DLC SMS registration** (Roadmap item 5), and (c) where the cancellation and no-show policies belong in writing. Pairs with Gap 14: both are short static pages, both block SMS, so they should ship together, early. Needs the salon's legal name and contact details from the client.

#### Plan to complete Gap 25

**1. Get from the client (blocking; ask alongside the Gap 14 and SMS questions):**

- Exact legal business name, street address, and a contact email and phone for privacy requests.
- Who answers a data request or a deletion request, and how fast (30 days is a common commitment).
- How long booking and payment records must be kept for their accountant (tax records are commonly kept around 6–7 years; the accountant decides). This sets the retention section and how Gap 33's "delete my account" anonymizes rather than deletes.
- Whether they'll sell gift cards under these terms as built: no expiry, no fees, redeemed onto an account, lost codes voided and reissued, not exchangeable for cash. NY has specific gift-card rules, so their accountant or lawyer should confirm this wording.
- Their no-show and late-cancellation policy in words (the app records no-shows but charges nothing; there are no payments in the app).
- Whether a minimum age applies. A clean default: accounts are for 13+; a parent or guardian books for younger children.

**2. Write the two pages' content (Eric drafts, client approves; ideally a lawyer reads it once).** Nothing here is legal advice, and generated boilerplate shouldn't ship unreviewed.

- **Privacy policy (`/privacy`):**
  - **What is collected:** name, email, phone, booking history, store-credit history, and request logs kept by the host.
  - **Why:** booking, confirmations and reminders, receipts, and running the salon.
  - **Who processes it:** Neon (database), Resend (email), Cloudinary (artist photos), Cloudflare (hosting and edge logs), and Twilio once SMS ships.
  - **No selling and no ad tracking.** There's no analytics or advertising cookie today, only the strictly necessary session cookie, so **no cookie banner is needed**. If Gap 35 adds Cloudflare Web Analytics (cookieless), name it here.
  - **Retention:** the client's answer above.
  - **Your choices:** view and correct your details on My Account; email the salon to delete your account until Gap 33 builds it into the app.
  - **Security:** passwords are hashed, staff access is separate, and the site is HTTPS-only. Customers will be notified of a breach as New York law requires (NY's SHIELD Act covers notification and reasonable safeguards).
  - **Contact, and a "Last updated" date.**
  - **When SMS ships,** add the carrier-required clause: mobile numbers and SMS opt-in consent are never shared with third parties or affiliates for marketing. The 10DLC campaign reviewers look for that sentence specifically.
- **Terms (`/terms`):**
  - **Accounts:** one per person, accurate details, email confirmation.
  - **Booking rules:** the 14-day window, the per-customer caps, the cancellation and reschedule notice window, standing appointments needing an end date, and that the salon may cancel for closures.
  - **No-show policy,** in the client's words.
  - **Gift cards and store credit,** as built and as the client confirmed.
  - **Prices:** charged in the salon, at the price shown when booked.
  - **Then:** limitation of liability, governing law (New York), contact, and a "Last updated" date.

**3. Build (about half a day, once the text is approved):**

- `src/app/privacy/page.tsx` and `src/app/terms/page.tsx` as Server Components with their own `metadata` (title, description, canonical), a `LAST_UPDATED` constant, and the same type styles as the About page.
- **Every number comes from the live source, never typed into the text:** the notice window from `getPolicySettings()`, the booking window from `BOOKING_WINDOW_DAYS`, the caps from `src/lib/booking-limits.ts`, the series limit from `customerMaxSeriesWeeks()`. That's the same rule the About page follows, so changing a setting can't make the terms wrong.
- **Links:**
  - The footer, next to the address and hours from Gap 14 / U9.
  - A line under the register button: "By creating an account you agree to the Terms and Privacy Policy". A link, not a required checkbox.
  - The booking review step's policy line.
  - The email template footer.
- Both pages stay public (no guard). Add them to `sitemap.xml` when Gap 19 lands.

**4. Verify:** both pages render signed out at 375px with no horizontal scroll; the footer, register and review-step links resolve; the numbers on the page change when the settings change; they print cleanly (site chrome is already `print:hidden`).

**5. Ship before the SMS work starts:** the 10DLC registration needs the privacy policy live **on the public domain**, so this goes out with or right after the deploy (Roadmap item 1), together with Gap 14.

### Gap 26 — SHOULD — No error monitoring or uptime alerting

**Status: CLOSED in the app (2026-10-19); the deploy steps are in `docs/DEPLOY_RUNBOOK.md` §11.** Built without a vendor SDK, so nothing is added to the Workers bundle:

- `src/instrumentation.ts`: Next's `onRequestError` hook reports every uncaught server error, whether a page or a route handler.
- `src/lib/report-error.ts`: every report is one JSON log line (`"level":"error"`, `event`, path with the query string removed, route, Next's `digest` so a customer's error-page screenshot can be matched). Request headers and email recipients are never included. With `ERROR_ALERT_WEBHOOK_URL` set (Slack or Discord), it also posts a one-line summary, at most once per kind of error per 5 minutes per instance. Email failures (`email_failed`, including the production "no API key" case) and reminder runs with failures (`reminders_failed`) report through it too.
- `GET /api/health`: `200` when the database answers, `503` otherwise. Public, no details, `no-store`.
- `CRON_HEARTBEAT_URL`: pinged after each reminder run, for a dead-man's-switch monitor. It catches the scheduler silently never calling.

**Verified:** on the production build, health `200`, heartbeat received, email failures logged and posted once (throttled). On a second instance with an unreachable database: a page, a route handler and the health check each produced a JSON report and a webhook post, with the right route and digest, and a `?x=secret-token` query string stripped. **Left for deploy:** turn on Workers Logs, create the alert channel and the uptime and heartbeat monitors, and decide with the client who gets alerted.

**Location:** absent

`sendEmail()` swallows failures by design (correct for the request), and route handlers return `500`s that nobody is told about. In production, a broken Resend key or an exhausted Neon pool would show up as "customers stopped getting emails" weeks later. Wanted at deploy: Workers observability or a Sentry-style error reporter, an uptime check on `/` and one API route, and an alert if the reminder cron (`/api/jobs/send-reminders`) stops returning `200`. Belongs in `docs/DEPLOY_RUNBOOK.md`.

---

## Second review (2026-10-19) — nice to have

### Gap 27 — NICE — No waitlist when the day is full

When `SlotGrid` has nothing it shows "No open times on this day," and that's the end. Cancellations and no-shows free slots (by design), but nobody who wanted them is told. A simple waitlist (customer + date + optional artist; emailed when a matching slot frees up, first come first served, with no automatic booking) turns cancellations back into revenue. It reuses the `after()` email path. **Do the U6 "next available day" hint first**: it covers most of the same frustration for almost no cost.

### Gap 28 — NICE — Customer detail page has no summary or repeat no-show flag

**Status: CLOSED (2026-10-19).** `src/lib/customer-summary.ts` (pure, 5 unit tests with hand-worked figures) computes:

- visits (completed only)
- total spent and the average visit, after discounts
- last visit and next booking
- usual artist and the top 3 services (by count, ties to the most recent)
- no-shows and the no-show rate (no-shows ÷ completed + no-shows; blank before either has happened)
- cancellations

Where it shows:

- **Customer page:** a Summary panel (`customer-summary-panel.tsx`).
- **Repeat no-shows (2 or more, `NO_SHOW_FLAG_THRESHOLD`):** a red badge in three places, all using the same threshold:
  - the customer page ("call ahead to confirm")
  - the schedule's detail sheet, where the customer's name now also links to their page
  - the booking sheet's customer search results and header

Counts come from one grouped query for the customers on screen, and from a `_count` on the admin customer search (which still never returns `passwordHash`). **Not built:** late-cancellation counts. The app doesn't record when, or by whom, a booking was cancelled; that's Gap 21's audit log. **Verified:** 4 API checks and 6 browser checks at 375px.

Carried forward from Gaps 8 and 9: `/admin/users/[id]` lists raw history but computes nothing. Wanted: visits, lifetime spend, last visit, usual artist and services, no-show and late-cancel counts, plus a visible flag on the schedule's booking and detail sheets when a customer has, say, 2+ no-shows. That's the information a front desk uses to decide whether to call ahead. All of it is one `groupBy` over data that's already captured.

### Gap 29 — NICE — No "today at a glance" or confirmation queue for staff

`/admin` opens straight onto the grid. Customer self-bookings land as `PENDING` (so do customer reschedules), and the only way to find them is the status filter. Wanted: a count badge on the Bookings nav item, a "Needs confirming" list, and a small header strip (today's appointments, open slots left, expected takings). It pairs with Gap 16, since a confirmation queue that doesn't refresh is misleading.

### Gap 30 — NICE — No "Book Again" from a past visit

Nail clients rebook the same service with the same artist every 2–3 weeks. Past cards on My Bookings (`appointment-card.tsx`) have no action. A "Book Again" link to `/book?artistId=…&serviceIds=…` that pre-fills the wizard is a few lines (the wizard already reads `serviceId`/`artistId` params; multi-service needs a small extension) and is the staff-side "Book Next Visit" made self-serve.

### Gap 31 — NICE — Standing appointments just stop

Already an accepted limitation in `PROJECT_STATUS.md`. A standing appointment ends at its mandatory end date with no warning, so a regular silently drops off the schedule. A "your standing appointment ends in 2 weeks" email to the customer, plus a list on `/admin/recurring` of series ending soon, would fix it. It can run in the same daily cron as reminders.

### Gap 32 — NICE — No reviews, testimonials, or social links

There are no Instagram, Facebook or Google Reviews links anywhere (`footer.tsx` has only internal links). For a nail salon, Instagram *is* the portfolio for most new customers, and the review count on Google decides whether they book. Wanted: social links in the footer and About page, a "Leave us a review" link in the checkout receipt email, and 2–3 real testimonials on the home page (from the client, with permission). Don't build an in-app review system; link to Google.

### Gap 33 — NICE — Customers can't delete their account or get their data

Only `GET`/`PATCH` exist on `/api/users/me`. Once a privacy policy exists (Gap 25), it has to say how someone gets their data removed. The minimum is a "delete my account" request that anonymizes the `User` (name, email, phone cleared; appointments, ledger and pay snapshots kept for the salon's books, since those are `RESTRICT`-protected anyway) and cancels future bookings. Refuse while store credit is owed, or show the balance first.

### Gap 34 — NICE — The owner can't export anything

There is no CSV export of customers, appointments or the pay report (the pay report prints, but doesn't export). An owner handing numbers to an accountant, or leaving the platform, needs one. The pay report's data loader makes "Download CSV" there almost free. Separately, confirm Neon's point-in-time restore window covers the salon's needs and write the restore procedure into the runbook.

### Gap 35 — NICE — No idea where customers drop off

There's no analytics at all. It isn't needed for operation, but "how many people start a booking and how many finish, and at which step do the rest leave" is the question that decides which UI work below is worth doing. Cloudflare Web Analytics (cookieless, no banner, already on the deploy platform) plus a handful of step events would answer it. Don't add a third-party tracker.

### Gap 36 — NICE — Accessibility gaps

**Status: CLOSED (2026-10-19).** What was done:

- **Skip link:** "Skip to content" is the first Tab stop on every page, hidden until focused, and moves focus to `<main id="main">`.
- **Step indicator:** each step carries screen-reader text ("Step 2 of 4: Artist, current step") and the active step has `aria-current="step"`. Inactive numbers are navy instead of grey for contrast.
- **`window.confirm` replaced** on the admin customer page by the same in-page Yes / Keep Signed In swap as every other destructive action.
- **Announcements:** the original finding here was wrong. The app already had about 50 `role="status"`/`role="alert"` messages (both are live regions); a search for `aria-live` alone found only one. The two that were missing, the time-slot loading error and the standing-appointment row's error, now have `role="alert"`.
- **Reduced motion:** a global `prefers-reduced-motion: reduce` rule in `globals.css` makes every transition and animation instant, including anything added later (U5).
- **Contrast,** measured against WCAG AA (4.5:1 for normal text, 3:1 for large text and focus rings), fixed in the theme tokens so the look is unchanged:

| Pair | Before | After |
|---|---|---|
| `--muted-foreground` on `--background` | 4.36 | **5.45** (`#52606c`) |
| Gold text on the cream backgrounds (prices, active admin link, text buttons, link hover) | 2.72 | **4.73**: new `--primary-strong` (`#8a5f1e`) for gold *text*; `--primary` stays the fill colour |
| White on the gold price tags | 3.23 | **5.06** (navy text) |
| `--success` text (sign-in notices) | 4.21 | **5.01** (`#287052`) |
| Footer copyright (`--on-dark-subtle` on navy) | 3.83 | **4.89** (`#7d8f9e`) |
| Script headings on the blue Services/Artists bands (gold) | 1.67 | **3.39** (tan `--muted`, large text) |
| Script line on the gold closing band (blue) | 1.67 | **5.06** (navy) |
| Muted badges (grey on tan) | 3.24 | navy text |
| Button focus ring (gold on cream) | 2.72 | **4.55** (blue) |

`offline.html` and `global-error.tsx` got the same grey; the service worker's `CACHE_VERSION` was bumped so the new offline page replaces the cached one.

**Verified** in the browser at 375px: Tab order, skip-link focus, computed token colours, `aria-current` moving between steps, the confirm swap, and reduced motion. **Still worth doing before launch:** a real screen-reader pass (VoiceOver on an iPhone, since that's what most customers will use) over booking and My Bookings, plus the `design:accessibility-review` checklist for keyboard traps in the schedule's sheets.

**Explicitly not gaps** (out of scope by decision, listed so they aren't re-raised): online payment or deposits, selling gift cards online, a native app, an AI receptionist. See `PROJECT_STATUS.md`.

---

## UI and feel

What would make the site feel more vibrant, easier to use and more like the salon, without changing the old-Hollywood theme (navy / gold / cream, Bodoni Moda + Yesteryear + Jost), which is distinctive and worth keeping. Ordered by impact for the effort. **U1–U4 are the quick wins.**

**Status (2026-10-19): U1–U13 built.** U14 (not recommended) stands. No migration was needed.

**Salon details:** the address, phone, email, Instagram, Facebook and review links live in `SALON_CONTACT` (`src/lib/site.ts`). They're all `null` until the client supplies them (Gap 14), and anything null is simply not shown, so nothing invented reaches a customer. Opening hours need no setting: `getSalonHours()` derives them from the active artists' weekly availability, and a salon-wide closure covering today closes today.

**Verified** against a production build at 375px (and 1280px for the admin sidebar): 7 API checks on the new `/api/artists/:id/open-days`, 46 browser checks, a settings-toast re-check, and three visual follow-ups (scroll reveal, header fit, check-mark animation). Plus tsc, ESLint and 32/32 unit tests (4 new for the calendar file). Screenshots were reviewed at each step; two problems they showed were fixed: "NAIL IMAGE INC." was cut off in the phone header, and "View All →" wrapped. All test data was removed afterwards.

| # | What was built | Where |
|---|---|---|
| U1 | The newest portfolio photo behind the hero's navy wash (the stripes stay as the fallback); a "Fresh From the Studio" strip of the latest 8 uploads (swipeable on phones, a grid from md); the hero colours moved into `globals.css` tokens. "Est. 2014" left as is, flagged in a comment to confirm with the client. | `src/app/page.tsx`, `globals.css` |
| U2 | Every service row shows its description and duration and has its own **Book** link; titles are `text-4xl sm:text-6xl` on Services and Artists. **Not built:** category photos (no images exist for them yet). | `src/app/services/page.tsx` |
| U3 | A compact **Book** button beside the menu icon below `lg` (not shown on `/book` itself). | `header.tsx` |
| U4 | One shared toast (`useToast()`, live region always present, 4.5 s, dismiss button, navy with gold edge) on the success path of: My Bookings cancel and reschedule, profile save, every admin manager (services, artists, availability, time off), policies, the booking switch, customer edits, sign-out-everywhere, and every action in the schedule's detail sheet. Errors stay inline. Notices that need to stay visible stay inline too: the pending-email link, and the time-off cancellation count. | `src/components/ui/toast.tsx` |
| U5 | Card lift on hover; a "pop" on picked days, times, services and artists; the confirmation's check mark draws itself; the hero stars twinkle once; home sections fade up as they scroll in (`Reveal`, which only hides sections still below the fold). All under `prefers-reduced-motion: no-preference`, on top of the global reduced-motion rule. CSS only. | `globals.css`, `reveal.tsx` |
| U6 | Artist photos and a bio line in the artist step. Full days greyed out, struck through and disabled, from one new request (`GET /api/artists/:id/open-days`). The strip starts on the first day with an opening. An empty day shows **"Next opening: Thu, Oct 23, 10 AM →"**. Over 12 times are grouped Morning / Afternoon / Evening. Completed steps in the indicator can be tapped to go back. The sticky bar keeps "1 service · 45 min · $45.00 · Libby Bent" in view. The day-strip changes apply to the reschedule pickers too. | `steps/*`, `booking-wizard.tsx`, `wizard-state.ts` |
| U7 | "You're booked!" in Yesteryear, the artist's photo, the date in large Bodoni, a booking reference, **Google Calendar** and **Apple / Outlook** (`.ics`, with every visit of a standing appointment), the address with a map link and the phone (once set), the live cancellation policy, **Book Again** (same services and artist, straight to the time step), and "Book something else". This also covers most of Gap 20. | `confirmed-step.tsx`, `src/lib/calendar.ts` |
| U8 | Skeleton loading screens for My Bookings and **each admin page** (its own `loading.tsx`, built from shared blocks in `page-skeletons.tsx` that copy the real cards' classes and line heights; compared side by side with the real pages at 1280 and 375px); empty states with an icon, a sentence and the next step (My Bookings, Services, Artists, and the admin services, artists, availability and time-off lists). | `skeleton.tsx`, `empty-state.tsx`, both `loading.tsx` |
| U9 | Footer: address, phone and email (each once set, with map, `tel:` and `mailto:` links), "Open today 9 AM – 5 PM" or "Closed today", the week's hours, page links, and Instagram/Facebook pills (once set). Privacy and terms links come with Gap 25. | `footer.tsx`, `src/lib/salon-hours.ts` |
| U10 | Every email: cream page, navy header band with the salon name in a serif stack, a card body with ruled detail rows, a gold button with navy text, and a footer with the salon's contact lines. Table-based and inline-styled, with no images (it reads the same with images blocked). The receipt adds "Leave us a review" once `reviewUrl` is set. The plain-text versions got the contact lines too. | `email-templates.ts` |
| U11 | The portfolio opens in a native `<dialog>` viewer: arrow keys, swipe, caption, "1 of n", a 44px close button, and **Book with {name}**. Focus trapping, Escape and focus return come from `showModal()`. | `portfolio-gallery.tsx` |
| U12 | Artist cards show specialty chips (their own services, or the menu's categories for "every service" artists), **"Next opening: Today 3:15 PM"** (or "Fully booked for the next two weeks"), and up to 3 portfolio thumbnails. The data is shared by home and `/artists` (`loadArtistCards()`). | `artist-card.tsx`, `src/lib/artist-cards.ts` |
| U13 | A red current-time line across today's columns (minute clock, browser only); the admin nav grouped into Schedule · Catalog · People · Money · Settings (sidebar headings on desktop, labels in the strip on phones; "Users" is now "Customers"); a status legend beside the category legend. | `schedule-now-line.tsx`, `admin-nav.tsx`, `schedule-grid.tsx` |

**Refactor that came with U6/U12:** `getOpenSlots()` is now loaders plus a pure `computeOpenSlots()`, which the new `getOpenDays()` (a window of days in three queries) reuses, so both apply exactly the same rules. `fittingStarts()` (where a visit of a given length fits) moved into `schedule-grid.ts`, shared by the server and the wizard. The `excludeAppointmentId` permission check is one helper (`src/lib/exclude-appointment.ts`) used by both availability routes.

**Not verified in a browser:** the "Next opening →" button on an empty day. Greyed-out days and the auto-selected first open day mean a customer rarely lands on one now; it shows only for a reschedule picker's starting day or when a day fills while the page is open. The lightbox's previous/next buttons and swipe also weren't exercised: the dev data has only one portfolio photo.

### U1 — Put real nail photos on the home page

The hero is a CSS stripe pattern under a navy gradient (`src/app/page.tsx`), and the only photo on the public site outside artist pages is the 44px logo. Nail work is visual, and the salon's best sales material, the portfolio uploads, is invisible until someone opens an artist's page. Two changes:

- **Hero image:** one strong photo (the client's own, through Cloudinary) behind the existing gradient, so the copy stays readable. Keep the stripe pattern as the fallback.
- **"Fresh From the Studio" strip:** the latest 6–8 `PortfolioImage` rows across all artists, as a horizontal scroll-snap row on phones and a grid on desktop, each linking to its artist. No new data needed.

Also move the hero's inline `rgba(...)`/hex gradient values into `globals.css` tokens, per the color convention. And confirm "Est. 2014" with the client: it's hardcoded copy.

### U2 — Make the Services page sell the services

`/services` shows only name and price per row, while the `Service` model has a description and duration, and the home page's `ServiceCard` shows both with a "Book This Service" button. The page customers browse to decide is the one with the least information on it. Show the description and duration under each name, make each row (or a small "Book" button) link to `/book?serviceId=…`, and consider one photo per category header (Hands / Feet / Wax).

Also: the `/services` and `/artists` page titles are `text-6xl` at every width. "Services & Pricing" at 60px wraps badly at 375px. Use `text-4xl sm:text-6xl`, as the home hero does.

### U3 — Keep "Book Now" visible on phones

On screens under `lg` (all phones), the header's nav, **including the Book Now button**, is inside the hamburger menu. The site's primary action is two taps away on the devices most customers use. Show a compact Book button next to the menu icon below `lg`, or a slim sticky bottom bar on public pages (not on `/book` itself or admin). The existing `StickyActionBar` component is the starting point.

### U4 — A small toast for "it worked"

There's no toast or snackbar component. Saves, cancels and redeems confirm with inline text that's easy to miss, especially when the action button is near the bottom of a long page. Add one shared `Toast` (`role="status"`, `aria-live="polite"`, auto-dismiss, themed navy with a gold accent) and use it for the success path of every mutation. Keep inline messages for *errors* next to the field that caused them. This also closes Gap 36's announcement item.

### U5 — Motion and micro-interactions (restrained)

The only animation in the app is the spinner. A few touches would make it feel alive without going cheesy:

- Cards (`ServiceCard`, `ArtistCard`) lift slightly with a deeper shadow on hover, instead of only a background change.
- Selected slot, day and service buttons give a short scale "pop" when picked.
- The confirmation step's check icon draws in, and the hero's three gold stars twinkle once on load. The star is already the theme's motif; use it as the celebration.
- Sections fade up as they scroll in on the home page.

Wrap all of it in `@media (prefers-reduced-motion: no-preference)`. Use CSS only (Tailwind `transition`/`@keyframes` in `globals.css`); no animation library is needed.

### U6 — Booking wizard polish

The wizard is solid functionally; these make it faster and friendlier:

- **Show artist photos and a short bio line** in the artist step; it currently doesn't use `CloudinaryImage` at all. People choose a person by face.
- **Grey out days with no openings** in `DayStrip`, and when a chosen day is empty, replace "No open times on this day" with "Next opening: Thu, Oct 23 →" as a button. That one change turns the wizard's main dead end into a tap.
- **Group times** into Morning / Afternoon / Evening in `SlotGrid` once a day has more than ~12 slots.
- **Label the step indicator** (Gap 36) and let completed steps be tapped to go back.
- **Running summary:** keep the "2 selected · 1h 15m · $65" line pinned in the sticky bar through every step, with the artist's name and photo once chosen.

### U7 — Make the confirmation a moment (Gap 20)

Right now the confirmation is a green check and two buttons. It's the happiest screen in the app and the one most likely to be screenshotted. Give it the theme: script "You're booked!" in Yesteryear, the artist's photo, the date in large Bodoni type, then **Add to Calendar** (Google link + `.ics` download), the address with a map link, the cancellation policy (live from `getPolicySettings()`), and "Book Again" / "View My Bookings". Gap 20 covers the content; this is the presentation.

### U8 — Skeletons and friendlier empty states

Loading states are a centered spinner. Skeleton cards that match the real layout (My Bookings cards, the schedule grid's columns) make the app feel faster at the same speed. Empty states are one-line grey text ("No portfolio photos yet", no upcoming bookings). Give each one an icon, a sentence in the salon's voice, and the obvious next action ("Nothing booked yet — [Book Now]").

### U9 — A footer that does the local-business job

The footer is the site name, four links and a copyright. Add the address (map link), today's hours, a tap-to-call `tel:` phone number, Instagram/Facebook icons, and links to the privacy and terms pages. This is the visible half of Gaps 14, 25 and 32, and the footer is where people look for it.

### U10 — Branded emails

The email layout (`renderHtml` in `src/lib/email-templates.ts`) is generic: `sans-serif`, a `#2a2a2a` button, no salon identity. Emails are the part of the product customers see most. Keep the no-`react-email`, inline-style approach, but use the theme: cream background, navy header band with the salon name in a serif stack (Georgia fallback, since web fonts don't load reliably in mail clients), gold button, and a footer with address, phone and the review link (Gap 32). Optionally add the logo as a hosted Cloudinary image with `alt` text, so emails still read well with images blocked.

### U11 — Portfolio lightbox

`PortfolioGallery` is a grid of square thumbnails with no way to see a photo larger, and the `caption` field is only used as `alt` text. Add a tap-to-open viewer (native `<dialog>`, swipe or arrow keys between photos, caption shown, Esc/close button with a 44px target) plus a "Book with {artist}" button inside it. That's the moment someone decides they want *that* set.

### U12 — Artist cards with more personality

Artist cards show photo, name and two lines of bio. Add specialty chips (from Gap 23's artist-services, e.g. "Gel · Nail Art · Pedicure"), a "Next opening: Today 3:15" line, and two or three portfolio thumbnails along the card's bottom edge. The card becomes a reason to click instead of a directory entry.

### U13 — Admin schedule quality-of-life

- A **current-time line** across the day view (none exists today) so staff can see at a glance who's running late.
- **Group the admin nav.** Ten flat links are a long horizontal scroll on a phone. Group them as Schedule · Catalog (Services, Artists, Availability, Time Off) · People (Users, Standing) · Money (Gift Cards, Pay Report) · Settings.
- **A legend** for the category colors and status styles on the grid.
- Pair with Gap 16 (auto-refresh) and Gap 29 (pending badge).

### U14 — Not recommended right now

- **Dark mode:** `globals.css` deliberately ships one light theme, and the cream-and-navy palette *is* the brand. Revisit only if customers ask.
- **A component library (shadcn, MUI):** the hand-built primitives in `src/components/ui/` are small, themed and consistent. Swapping them would cost a lot and make the site look more generic.

---

## What's already solid

Worth stating explicitly, both to avoid redoing it and because this is the interview material.

- **Double-booking is structurally impossible.** `AppointmentSlot.@@unique([artistId, slotStart])` enforces it at the database rather than in application logic, and the `P2002` race is caught and returned as a clean `409` rather than a crash.
- **The booking wizard handles the slot-taken race.** `review-step.tsx:106` catches the 409/"not available" case specifically rather than showing a generic failure.
- **Authorization is per-route and complete.** The deliberate rejection of middleware-based gating in favour of explicit `requireAdmin()` / `requireUser()` calls was verified across all 28 handlers in `SECURITY_AUDIT.md` with no guard missing or unawaited.
- **Soft deletes where they belong.** Services deactivate rather than delete; cancelled appointments keep their row and free only their slots. Business history survives.
- **Photo uploads are signed server-side** (`/api/admin/uploads/sign`), so Cloudinary credentials never reach the browser.
- **Checkout enforces payment capture on the server**, not just in the button — completing an appointment without a payment method is rejected with a 400.

---

## Suggested sequence

Ordered by what unblocks the most, not by size. Steps 1 and 2, and the reschedule half of step 4, are done — struck through below, left in place so the reasoning that motivated them stays visible.

~~**1. Email provider, then password reset.**~~
~~One provider plus a small send helper unblocks confirmations, reminders, reset links, and cancellation notices simultaneously. Password reset follows immediately — it's the trapped-customer case. Independent of the SMS registration wait, so it should not be sequenced behind it.~~
*Covered Gaps 1, 2 (2 partially — see that gap's note: the send helper exists, but confirmations/reminders/cancellation notices themselves are still unbuilt).*

~~**2. Let admins book in the past.**~~
~~A one-line exemption mirroring the existing admin bypass of the booking toggle. Smallest change on this list with the most direct effect on recorded revenue.~~
*Covered Gap 3 — took two attempts; see that gap's note on the `getOpenSlots()` filter the first pass missed.*

**3. ~~Price snapshot~~, then reporting.**
~~Copy `priceCents` onto `Appointment` at booking time first — otherwise every report built on top is wrong as soon as prices change.~~ Then build daily takings and the payment-method split; the rest of the data is already captured.
*Gap 17 (price snapshot) done 2026-10-13 — each `AppointmentService` line records its price and duration at booking. Gap 7 (reporting) still open; an artist pay report is planned in `PLAN_ARTIST_PAY_REPORT.md`.*

~~**4. Reschedule, and a cancellation notice window.**~~
~~The two policy gaps the salon will hit on the phone every week. Reschedule reuses the existing booking transaction shape; the cancellation window wants a configurable value rather than a hardcoded 24h, which means extending `AppSettings`.~~
*Reschedule (Gap 4) done — admin-only, time-only, same-artist, per the scoping discussion recorded in `PROJECT_STATUS.md`. Cancellation window (Gap 5) fully done as a hardcoded 24h in `DELETE /api/appointments/[id]`, including the terminal-status re-cancellation guard — not the configurable `AppSettings` value this line originally floated, which remains a nice-to-have rather than a gap.*

~~**5. Salon-wide closures, no-show status**~~**, and notes.**
~~Three small additive schema changes that remove recurring manual work and make the reporting from step 3 substantially more useful.~~
*Salon-wide closures (Gap 6) done — see `PLAN_SALON_CLOSURES.md` and `PROJECT_STATUS.md` for the full account, including a real RSC-boundary bug found and fixed along the way. No-show status (Gap 8) done, built together with the customer history view (Gap 9) — see `PROJECT_STATUS.md`. Notes (Gap 10) is still open; the "small additive schema change" framing has now held for three gaps in a row (6, 8, and by extension 9's page addition), so it's a reasonable prior for 10 too.*

~~**6. Standing-appointment management.**~~
~~Finish the half-built feature — a series list with pause/cancel, and make single-occurrence cancellation series-aware.~~
*Covers Gap 11 — done. Two admin surfaces (dedicated `/admin/recurring`, plus a scoped view on `/admin/users/[id]`) and customer self-service on `/appointments`, sharing one status-change transaction. Single-occurrence cancellation was deliberately left unchanged rather than made "series-aware" in the sense originally floated — see `PROJECT_STATUS.md`/`PLAN_RECURRING_MANAGEMENT.md` for why that turned out to be the right call once the real series-level cancel routes existed. A rolling re-materialization job for the 8-week horizon was later built (2026-10-10) and then removed (2026-10-12) when the client made a series end date mandatory — every week of a series is now booked at creation, and a series can only be cancelled (no pause/resume).*

**7. Public identity pages: address/hours (14), privacy and terms (25), footer (U9).** *(added 2026-10-19)*
Small static work, but it's the long pole for SMS registration and the first thing local visitors look for. Needs details from the client, so ask now.

~~**8. Protect bookings that already exist: time-off conflicts (22), artist services (23).**~~
~~Both stop the system from promising something the salon can't deliver. Gap 23 is a schema change, so it's cheaper before there's production data.~~
*Done 2026-10-19, along with 28 and 36 from step 12.*

**9. Finish reporting (7): daily takings and the payment-method split; notes (10); then the customer summary (28).**

**10. UI quick wins: U1–U4, then U6 + U7 (with Gaps 20 and 24) as one booking-flow pass.** *(U1–U13 done 2026-10-19; Gap 24 still open.)*
Mostly front-end, no migrations, and the most visible improvement per hour on this list. Gap 35's analytics, if added at deploy, shows whether the booking-flow pass worked.

**11. Operational readiness at deploy: monitoring (26 — app side done 2026-10-19; runbook §11 at deploy), export and backups (34), analytics (35).**

**12. Everything else** (12, 16, 19, 21, 27, 29–33), ordered by what the client asks for first.

---

## Note on `PROJECT_STATUS.md` accuracy

*Resolved.* This section originally flagged that `PROJECT_STATUS.md` still listed portfolio image upload as unbuilt after commit `4a1ef82` had shipped it on Cloudinary. That was corrected on 2026-10-15, and on 2026-10-16 `PROJECT_STATUS.md` was condensed into a current-state summary (full history archived in `docs/PROJECT_HISTORY.md`).
