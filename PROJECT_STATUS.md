# Project Status

**Living document — keep it short and current.** It orients a new Claude Code session (or Eric after a break) without re-reading git history. It describes **what is true now**; the long-form build log (bugs found, reasoning, how each feature was verified) lives in [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md), archived 2026-10-16 and not maintained. When something changes: update the relevant line here, add a dated entry to "Recent changes", and put any long write-up in a commit message or a separate doc, not here.

Last full review: **2026-10-16** — see [`AUDIT_2026-10-16.md`](AUDIT_2026-10-16.md) for findings and what was done about each. Deploy steps: [`docs/DEPLOY_RUNBOOK.md`](docs/DEPLOY_RUNBOOK.md).

## What this project is

A nail salon booking platform for a real local salon ("Nail Image Inc.", Amityville, NY), built by Eric DiGiacomo (CS + Applied Math/Stats, Stony Brook, May 2026) as a portfolio/interview project. Priorities: code Eric can explain, industry-standard patterns, honest trade-offs over clever shortcuts.

**Stack:** Next.js 16.4.2 (App Router, Turbopack — read `node_modules/next/dist/docs/` before using an API, per `AGENTS.md`) · TypeScript · Tailwind v4 (CSS-only config) · Prisma 7.10.1 (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`) · PostgreSQL on Neon · Auth.js v5 beta (Credentials + Google, JWT sessions) · Resend (raw `fetch`) · Cloudinary (signed browser uploads, served through `next/image`) · installable PWA. Deploy target: **Cloudflare Workers** (not done, see Roadmap).

## Architecture decisions (settled — don't relitigate without a real reason)

- **In-house scheduling engine** — the centerpiece interview story. No Calendly/Acuity/Square.
- **Double-booking prevention at the database:** fixed 15-minute `AppointmentSlot` rows with `@@unique([artistId, slotStart])`, chosen over a Postgres exclusion constraint. `P2002` → clean `409`. `AppointmentSlot` FKs are `RESTRICT`: delete an appointment's slots before the appointment, in one transaction. Every move of an existing appointment (admin reschedule/length/services, customer reschedule) goes through `reclaimSlots()` in `src/lib/booking.ts`.
- **No payments, ever.** Payment happens on the salon's POS. "Checkout" = admin marks `COMPLETED` + records `paymentMethod` (`CASH`/`CARD`/`OTHER`) + `checkedOutAt`. No `depositPaid`-style fields.
- **Soft deletes for business records:** cancelling an appointment sets `status` and deletes only its slots; services and artists deactivate via `active`. Availability, time off, and portfolio images are hard-deleted (nothing references them).
- **Auth:** every route that needs identity calls `requireAdmin()` / `requireUser()` (or `auth()` when it needs the role) **inside the route** — no `proxy.ts`/middleware gating, per Next 16's own guidance. JWT strategy (database sessions were broken for Credentials); the `jwt` callback re-reads the user each request, so role changes, deleted accounts, password resets (`passwordChangedAt`) and profile completeness (`profileIncomplete`) take effect immediately. `SAFE_USER_SELECT` (`src/lib/user-select.ts`) is the only allowed way to read users that leave the server.
- **Emails are stored lowercased and trimmed** (`normalizeEmail()`), on every write and every lookup — registration, sign-in, password reset, profile and admin edits, the Google adapter, the seed and the promote-admin script.
- **Images are Cloudinary-only.** The API accepts artist/portfolio image URLs only from the salon's own Cloudinary account (`isCloudinaryUrl()`); there's no paste-a-URL field. That's what lets the CSP `img-src` and `images.remotePatterns` name one host. Display goes through `CloudinaryImage` (`src/components/ui/cloudinary-image.tsx`).
- **REST API + client `fetch()` for mutations, not Server Actions** — a future React Native app must reuse the same API. Server Components read with Prisma directly; Client Components call `/api/*`.
- **Admin overrides are derived from the session role, never the request body:** admins may book for any user (`userId`), at any length (`durationMinutes`), in the past, past the 14-day window, and while self-booking is closed. A non-admin's override fields are silently ignored.
- **Salon policies live in `AppSettings`** and are edited on `/admin`: the self-booking on/off switch, `cancellationNoticeHours` (default 24 — the online cancel/reschedule window) and `maxSeriesWeeks` (default 52 — longest standing appointment). Read server-side with `getPolicySettings()` / `isBookingEnabled()` (`src/lib/settings.ts`); every customer-facing mention (About page, My Bookings, emails, error messages) reads the live value.
- **Email:** `sendEmail()` (`src/lib/email.ts`) never throws; with no `RESEND_API_KEY` it logs to the console instead of sending. Templates are plain strings that HTML-escape every interpolated value (no `react-email` — Workers startup-CPU issue). Sends run in `after()` so responses never wait on them.
- **PWA, kept deliberately small:** `src/app/manifest.ts`, icons in `public/icons/`, and a hand-written `public/sw.js` (no Workbox/next-pwa) that caches only content-hashed build assets plus a self-contained `public/offline.html`. **Pages and `/api/*` are never cached** — booking data must be live, and signed-in pages hold personal data. Registered in production builds only.
- **Rate limiting happens at Cloudflare's edge, not in the app** — rules are in the deploy runbook.
- **Mobile-first is a hard requirement** (375px first, 44px tap targets — the schedule grid's rows grow to 44px on touch screens). A native app is deferred.
- **Out of scope unless Eric reopens it:** payments, AI receptionist (Twilio + Claude), native app.
- **Timezone — known blocker:** no timezone library; all date math assumes server clock = salon clock and goes through the helpers in `src/lib/schedule-grid.ts` / `src/lib/format.ts` / `src/lib/recurring.ts` (`startOfDay`, `startOfWeek`, `endOfDay`, `timeStringToDate`, `toLocalDateKey`, `parseLocalDate`, `addDays`, `generateOccurrenceDates`). **Workers run in UTC, so this must be fixed before deploy.** New code must use these helpers — no inline `getHours`/`setDate`/`getDay` math.
- **Seed scripts are idempotent** (`upsert` with fixed ids). Run `npx prisma db seed`, not `tsx prisma/seed.ts` directly (the latter skips `.env` loading).

## What's built

Every item was verified live when built; details are in `docs/PROJECT_HISTORY.md` and `AUDIT_2026-10-16.md`.

**Customer site:** home, about, services (grouped by category), artists + portfolio pages, a multi-step booking wizard (multi-service, `useReducer` state machine; sign-in is required only at review, and picks survive the login and complete-profile redirects via `sessionStorage`), standing (recurring) appointment booking with a mandatory end date, login/register (name, email, phone and password; or Google), forgot/reset password, and My Bookings — **reschedule** (same artist, same services and length, new time within the 14-day window) or **cancel**, both online only outside the notice window — plus the standing-appointment list (cancel only) and profile edit. Signed-in users missing a name or real phone see a "complete your profile" banner and can't self-book until they fix it. Installable to a phone's home screen, with an offline page.

**Admin (`/admin`, role-gated in `admin/layout.tsx`):**
- Schedule grid — day view (all artists) and week view (one artist, Sun–Sat), a month-calendar jump panel, status/artist filters, time off drawn on the grid, blocks colored by service category. Click an open cell to book (existing customer or a new walk-in, one-off or standing).
- Appointment detail sheet — confirm, check out (payment method + optional % or $ discount), cancel, no-show, reschedule (same artist), change length, edit services, and "Book Next Visit" after checkout.
- Booking policies card (online booking switch, notice window, standing-appointment cap); services (with categories `HANDS`/`FEET`/`WAX`), artists (Cloudinary photo + portfolio upload), weekly availability, time off (per-artist or salon-wide, single day or date range), standing appointments (salon-wide list, cancel), and customers (search, detail page with history and inline edit).

**Data rules worth knowing:**
- Appointment statuses: `PENDING → CONFIRMED → COMPLETED`, or `CANCELLED` / `NO_SHOW`. Cancelled and no-show free their slots and can't be reopened (a new booking is made instead). A customer reschedule puts the booking back to `PENDING` for staff to re-confirm.
- An appointment holds 1–8 services (`AppointmentService`) with **price and duration snapshotted at booking**. Its real length is `endTime − startTime` (`durationMinutesOf()`); the services give only the "usual" length.
- Discounts are per appointment (`discountType` + `discountValue`), set at checkout, and the total is derived (`src/lib/discount.ts`).
- Standing appointments (`RecurringAppointment`) book **every week up front** at creation (up to `maxSeriesWeeks`); weeks that can't be booked are saved as `RecurringSkippedOccurrence`. A series can only be cancelled as a whole; its individual appointments are edited like any other.
- Customers can book up to 14 days ahead (`BOOKING_WINDOW_DAYS`, enforced server-side). Retired services and inactive artists can't be booked by anyone.

**Emails sent:** booking confirmation, standing-appointment summary, cancellation (customer- vs salon-worded), reschedule (admin or customer), checkout receipt, standing-appointment cancelled, password reset, and a 24h reminder via `POST /api/jobs/send-reminders` (`Authorization: Bearer $CRON_SECRET`). **Nothing calls the reminder job on a schedule yet.**

## Roadmap / open work

In rough priority order:

1. **Deploy to Cloudflare Workers** — blocked on: (a) the **timezone fix** above; (b) choosing an adapter (vinext vs OpenNext — OpenNext doesn't support Turbopack; run a real trial build first); (c) confirming `pg` + `@prisma/adapter-pg` and Next's image optimizer work under Workers. Everything else (env vars incl. **`AUTH_URL`**, rate-limit rules, HSTS, cron, Resend domain, direct DB URL for migrations) is listed in `docs/DEPLOY_RUNBOOK.md`.
2. **Testing** (none exists) — unit tests for `getOpenSlots`, `reclaimSlots`/booking transactions, discount math and validation helpers; integration tests for the API routes against a test database. The scratch verification scripts from the 2026-10-16 audit are a good starting checklist.
3. **CI** — GitHub Actions: lint, typecheck, `prettier --check`, test, and build on every push.
4. **Reporting** (`FEATURE_GAPS.md` Gap 7) — the highest-value open feature. The data is captured and prices are snapshotted. An artist pay report is planned in `PLAN_ARTIST_PAY_REPORT.md` (local only).
5. **Confirmation texting (SMS via Twilio)** — designed, not started. Blocked on A2P 10DLC registration, which needs a live public site and a privacy policy page — so it depends on item 1. Ask the client early whether the salon has an EIN, and for its exact legal name, address, and authorized rep. The SMS opt-in must be unchecked by default and never required to book. Full plan in `docs/PROJECT_HISTORY.md`, Roadmap item 13.
6. **Gift cards / Groupon vouchers** — planned in `PLAN_GIFT_CARDS_AND_VOUCHERS.md` (local only), not started.
7. **Remaining `FEATURE_GAPS.md` items** — notes (10), artist logins (12), address/hours/phone on the site (14), schedule auto-refresh (16), SEO/metadata (19), booking confirmation dead end (20), audit log (21).
8. **One-time Prettier pass (Eric)** — `npm run format` as its own commit once everything else is committed; ~120 files don't match `.prettierrc` yet. Until then, keep diffs scoped to what you changed.

## Known limitations (accepted for now)

- Adding time off or a closure over an existing booking doesn't cancel or flag it; the grid just shows both.
- Admin reschedule is time-only, same artist; customer reschedule is the same plus same length. Changing artist is cancel-and-rebook.
- A standing appointment just stops at its end date; nothing reminds anyone to renew it.
- Deleting a portfolio image or replacing a photo leaves the file in Cloudinary. One pre-uploads-only artist photo (`example.com`) in the dev database shows as initials until replaced.
- `npm audit` reports 5 "high" advisories, all in eslint-config-next's `braces`/`micromatch` chain — dev-only lint tooling; npm's only offered fix is a downgrade to Next 14.
- The portfolio manager's delete (×) button is 28px — admin-only, desktop-first, but under the 44px rule.

## Conventions

- **Route shape:** guard first → `readJsonObject(request)` (`src/lib/request.ts`; `400` on bad JSON, non-objects and arrays) → validate with the helpers in `src/lib/validation.ts` (`normalizeEmail`, `requiredText`/`optionalText` with `TEXT_LIMITS`, `normalizePhone`, `isCloudinaryUrl`) and `passwordError()` → existence checks return **`404`**. Responses are always `{ data }` / `{ error }`. `PATCH` fields are optional (`undefined` = don't touch, `null` = clear where allowed). Catch `P2025` → `404` and `P2002` → `409`.
- **Client-safe modules:** anything imported by a Client Component must not import Prisma, even transitively — this has broken the build three times. Pure helpers live in `schedule-grid.ts`, `format.ts`, `recurring.ts`, `appointment-services.ts`, `discount.ts`, `service-category.ts`, `validation.ts` and `time-off.ts`; server-only logic lives in `availability.ts`, `booking.ts`, `settings.ts` and `appointment-emails.ts`. Constants shared between a Server Component and a Client Component go in a plain module, never in a `'use client'` file. Server pages pass settings values down as props.
- **Migrations:** Prisma's auto-diff can't rename enum values, add a required column to a non-empty table, or add a unique constraint non-interactively. Hand-write those, name the folder with a **UTC** timestamp, apply with `prisma migrate deploy`, and **ask Eric first**. Each deploy so far has left Prisma's advisory lock held on Neon's pooled connection; release it with `SELECT pg_advisory_unlock(72707369)` (run it until `pg_locks` shows none).
- **Colors:** use the theme tokens in `globals.css` (`text-body`, `text-on-dark*`, `bg-cream`, …), not hex values in class names.
- **Admin CRUD pages:** build the visual scaffold with stubbed handlers first, then wire up and verify each handler one at a time.

## Environment gotchas

- **Verification with a headless browser:** wrap scripts in `try/finally` so the browser always closes; check for orphan Chromium/node processes before and after; prefer one long Playwright session. Install Playwright in a scratch folder outside the repo rather than `--no-save` into it. Playwright's `setOffline` doesn't affect service-worker fetches — to test the offline page, stop the server. Leaked processes have crashed this machine once (OOM).
- **Dev server:** start test servers with `RESEND_API_KEY=""` (the `.env` has a real key — otherwise test bookings send real email). If a request hangs at "Compiling…", count `node` processes; a stale `.next` once spawned ~1,900. Kill them all, `rm -rf .next`, restart.
- **Production build locally** (`next build && next start`): needs `AUTH_URL` set or every sign-in fails with `UntrustedHost`. Dev output lives in `.next/dev`, so a production build doesn't disturb it. The service worker only runs in production builds.
- `next dev` may add or refresh a managed `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md` (Next 16.3+); that's expected — commit it.
- npm now blocks package install scripts by default (`npm warn allow-scripts`). Prisma's engines were already present; if a fresh install breaks `prisma migrate`, run `npm approve-scripts prisma @prisma/engines`.
- Background processes started from the Bash tool are invisible to PowerShell's process tools — manage them from Bash (`netstat -ano`, `taskkill //PID`).
- App Router folders starting with `_` are private (not routed).
- JSX text that continues after `{…}` on a wrapped line can lose its leading space under Turbopack — build such sentences as one template string.
- `npm run promote-admin -- <email>` is the production way to create the first admin.

## Recent changes

- **2026-10-16 (round 2) — every open audit item applied** (`AUDIT_2026-10-16.md`, "Round 2"). Security: Next 16.2.11 → 16.4.2 (critical RCE advisory) and Prisma 7.9 → 7.10.1; emails normalized; passwords capped at 72 bytes; Cloudinary-only images; `sslmode=verify-full`. Features: customer reschedule; admin-editable notice window and series cap (migration `20261016200229_add_policy_settings`); required name at registration plus the profile prompt; 44px schedule rows on touch screens; PWA (manifest, icons, service worker, offline page); `global-error.tsx`; loading states for admin and My Bookings. Cleanup: `readJsonObject` across 21 handlers, `{ data }` responses everywhere, `404` for unknown ids, text limits and trimming, color tokens, `$0` services allowed, broken symlinks and unused SVGs removed, `dotenv` declared. Docs: `docs/DEPLOY_RUNBOOK.md` (rate-limit rules, `AUTH_URL` requirement found by a local production build). 80/80 API checks and 30/30 browser checks passed against a production build.
- **2026-10-16 (round 1) — Repo audit and cleanup.** Docs restructured (this file condensed, history archived, README, `.env.example`); retired services unbookable; cancelled/no-show can't be reopened; Web Crypto Cloudinary signing; branded 404 and error pages.
- **2026-10-15** — Admin week view, Book Next Visit from checkout, service categories with a category-colored grid.
- **2026-10-13** — Multi-service appointments with price snapshots, per-appointment length override, discounts, `UPCOMING` → `PENDING` rename, standing appointments made cancel-only with a mandatory end date, admin booking moved onto the schedule grid.
- **2026-10-10** — Booking emails and 24h reminder job, month-calendar picker, standing-appointments rework.
- **Sept 2026** — Feature-gap blockers closed (password reset, past-time admin booking, reschedule, cancellation window, salon-wide closures), no-show tracking, customer history, standing-appointment management, Cloudinary uploads, security audit remediation (`SECURITY_AUDIT.md`, local only).

## Current dev-database notes

- `testing@gmail.com` (customer), the "Pedicure" service, and a few appointments dated 2026-08-25 / 2026-09-01 look like Eric's own manual test data — left alone; ask before deleting.
- The self-booking toggle has been found **off** in recent sessions; restore whatever state you find after testing. Policy settings are at their defaults (24h / 52 weeks).
- Dev admin login (from the seed): `admin@example.com` / `admin12345`, unless `SEED_ADMIN_*` was set. It was seeded before names were required, so it shows the profile banner until a name is added on My Profile.
