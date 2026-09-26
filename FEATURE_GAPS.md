# Feature Gap Analysis

**Project:** Nail salon booking platform (Next.js 16 App Router + TypeScript + Prisma + PostgreSQL/Neon + NextAuth v5)
**Analysis date:** 2026-09-23
**Reviewed commit:** `4a1ef82` (main)
**Scope:** Product/feature completeness review — what a working salon still needs from the customer site and admin dashboard. Read-only audit of 27 API routes, 17 pages, and 11 Prisma models.
**Companion docs:** `SECURITY_AUDIT.md` covers security posture; this document covers functional gaps. `PROJECT_STATUS.md` is the build history and roadmap.

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
| 2 | **BLOCKER** | No email sending of any kind | *(absent codebase-wide)* | **PARTIAL** — sending infra exists; only password reset uses it |
| 3 | **BLOCKER** | Admins can't book in the past — walk-in revenue unrecordable | `src/app/api/appointments/route.ts` | **CLOSED** |
| 4 | **BLOCKER** | No reschedule — status is the only editable field | `src/app/api/admin/appointments/[id]/route.ts` | **CLOSED** |
| 5 | **BLOCKER** | No cancellation notice window | `src/app/api/appointments/[id]/route.ts` | **CLOSED** |
| 6 | **BLOCKER** | No salon-wide closure (holidays) | `prisma/schema.prisma` — `TimeOff` | **CLOSED** |
| 7 | **SHOULD** | No reporting/revenue view despite data being captured | *(absent)* | Open |
| 8 | **SHOULD** | No no-show tracking | `prisma/schema.prisma` — `AppointmentStatus` | **CLOSED** |
| 9 | **SHOULD** | No customer history view | `src/app/admin/users/` | **CLOSED** |
| 10 | **SHOULD** | No notes field anywhere (customer or appointment) | `prisma/schema.prisma` | Open |
| 11 | **SHOULD** | Standing appointments can be created but never managed | `src/lib/recurring.ts` | **CLOSED** |
| 12 | **SHOULD** | Artists can't log in — admin-only role model | `prisma/schema.prisma` — `Role` | Open |
| 13 | **SHOULD** | No rate limiting on public routes | *(absent)* | Open |
| 14 | **SHOULD** | Site never states address, hours, or phone | `src/app/about/page.tsx` | Open |
| 15 | NICE | Day view only — no week view | `src/app/admin/page.tsx` | Open |
| 16 | NICE | Schedule never auto-refreshes | `src/components/admin/` | Open |
| 17 | NICE | Historical appointments show today's price | `prisma/schema.prisma` — `Appointment` | Open |
| 18 | NICE | No `error.tsx` / `not-found.tsx` / `loading.tsx` | `src/app/` | Open |
| 19 | NICE | No per-page metadata, OG tags, sitemap, or structured data | `src/app/` | Open |
| 20 | NICE | Confirmation step is a dead end | `src/components/booking/steps/confirmed-step.tsx` | Open |
| 21 | NICE | No audit log | *(absent)* | Open |

All closed/partial gaps were verified live against the real dev database (not just typechecked or reasoned through) at the time each was fixed — see `PROJECT_STATUS.md`'s "Completed so far" section for the full build/verification account of each. Of the six original blockers: five fully closed (1, 3, 4, 5, 6), one partially closed (2 — the send path exists, but only password reset uses it). Of the "should have" findings, three more are also now closed (8, 9, 11).

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

**Status: CLOSED** (for the password-reset use case — see Gap 1). Full account in `PROJECT_STATUS.md`. Summary: `src/lib/email.ts` sends via Resend's REST API (raw `fetch()`, no SDK — see that doc for why), with a console dev-driver when no API key is configured. **Not closed for its other consequences** — booking confirmations, reminders, and cancellation notices below are still unbuilt; only the password-reset email exists today.

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

Note this also interacts with Gap 11: cancelling one materialized occurrence of a standing appointment does not touch the parent `RecurringAppointment`, so nothing prevents the series from re-materializing it. (Also still true after the fix — unaffected.)

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

The schedule shows one day, stepped with prev/next buttons (`src/lib/schedule-grid.ts`; the query is bounded `startOfDay`/`endOfDay`). Planning staffing or spotting a quiet afternoon means clicking day by day. A week view is the default in most salon software for that reason.

Note the grid bounds derive from `Availability` rows only and never consider appointments — so an appointment outside configured hours (which Gap 3's fix could introduce) would compute an out-of-range grid row.

### Gap 16 — NICE — The schedule never refreshes on its own

No `router.refresh()`, `setInterval`, `EventSource`, or `WebSocket` anywhere in `src/components/admin/`. The grid is a snapshot from page load, and mutations update local state only.

If a customer books online while the front desk has the dashboard open, it won't appear until someone manually reloads. Two staff on two devices will silently disagree about the day's schedule. A periodic `router.refresh()` is the cheap fix.

### Gap 17 — NICE — Historical appointments show today's price

`Appointment` has no price field — price is read live from the related `Service`. Raising a manicure from $45 to $50 retroactively rewrites **every past appointment** to $50, including ones already checked out and paid at the old price.

Severity is "nice" only because nothing currently reports on price. **It becomes a correctness blocker the moment Gap 7 is built**, so snapshot `priceCents` onto `Appointment` at booking time *before* the reporting work, not after.

### Gap 18 — NICE — No error, not-found, or loading pages

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

**3. Price snapshot, then reporting.**
Copy `priceCents` onto `Appointment` at booking time first — otherwise every report built on top is wrong as soon as prices change. Then build daily takings and the payment-method split; the rest of the data is already captured.
*Covers Gaps 17, 7. Still open.*

~~**4. Reschedule, and a cancellation notice window.**~~
~~The two policy gaps the salon will hit on the phone every week. Reschedule reuses the existing booking transaction shape; the cancellation window wants a configurable value rather than a hardcoded 24h, which means extending `AppSettings`.~~
*Reschedule (Gap 4) done — admin-only, time-only, same-artist, per the scoping discussion recorded in `PROJECT_STATUS.md`. Cancellation window (Gap 5) fully done as a hardcoded 24h in `DELETE /api/appointments/[id]`, including the terminal-status re-cancellation guard — not the configurable `AppSettings` value this line originally floated, which remains a nice-to-have rather than a gap.*

~~**5. Salon-wide closures, no-show status**~~**, and notes.**
~~Three small additive schema changes that remove recurring manual work and make the reporting from step 3 substantially more useful.~~
*Salon-wide closures (Gap 6) done — see `PLAN_SALON_CLOSURES.md` and `PROJECT_STATUS.md` for the full account, including a real RSC-boundary bug found and fixed along the way. No-show status (Gap 8) done, built together with the customer history view (Gap 9) — see `PROJECT_STATUS.md`. Notes (Gap 10) is still open; the "small additive schema change" framing has now held for three gaps in a row (6, 8, and by extension 9's page addition), so it's a reasonable prior for 10 too.*

~~**6. Standing-appointment management.**~~
~~Finish the half-built feature — a series list with pause/cancel, and make single-occurrence cancellation series-aware.~~
*Covers Gap 11 — done. Two admin surfaces (dedicated `/admin/recurring`, plus a scoped view on `/admin/users/[id]`) and customer self-service on `/appointments`, sharing one status-change transaction. Single-occurrence cancellation was deliberately left unchanged rather than made "series-aware" in the sense originally floated — see `PROJECT_STATUS.md`/`PLAN_RECURRING_MANAGEMENT.md` for why that turned out to be the right call once the real series-level cancel routes existed. A rolling re-materialization job for the 8-week horizon remains a separate, still-open follow-up this work surfaced but deliberately didn't build.*

---

## Note on `PROJECT_STATUS.md` accuracy

`PROJECT_STATUS.md` currently lists **portfolio image upload** as "not started, still blocked on the Cloudinary-vs-S3 decision (unscoped)" in several places, including the "Not yet built" section and roadmap item 5.

It is built and shipped — commit `4a1ef82` ("Feature: image uploads"), using Cloudinary with server-side signed uploads (`src/app/api/admin/uploads/sign/route.ts`, `src/components/admin/photo-upload-field.tsx`, `src/components/admin/artists/portfolio-manager.tsx`). The Cloudinary-vs-S3 decision was evidently made in favour of Cloudinary.

Worth correcting, since that document is the orientation point for new sessions and this is the exact kind of staleness it warns against.
