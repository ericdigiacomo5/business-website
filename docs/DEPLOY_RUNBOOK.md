# Deploy Runbook (Cloudflare Workers)

Steps to apply when the site first goes live. Nothing here is done yet; the deploy itself is Roadmap item 1 in `PROJECT_STATUS.md`. Blockers that must be solved first, in this order: the **salon timezone fix** (§6 — Workers run in UTC) and choosing and trial-building the **Next.js adapter** (vinext vs OpenNext). Security items that are still open are tracked in `SECURITY_AUDIT.md` (local only); the IDs in brackets below refer to it.

## 1. Environment and secrets

Every value goes in as a **Wrangler secret** (`wrangler secret put NAME`, or the dashboard's encrypted variables) — never in `wrangler.toml`/`wrangler.jsonc` `[vars]` or any committed file.

**Runtime** (the Worker reads them on each request):

- `DATABASE_URL` — the **runtime role** from §3, pooled URL, keep `sslmode=verify-full`.
- `AUTH_SECRET`, `CRON_SECRET` — generate **new** ones for production (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`); never reuse the dev values.
- **`AUTH_URL`** — the real `https://` domain. Required: in a production build, Auth.js rejects every sign-in with `UntrustedHost` without it. It also switches on the HSTS header (§5) and is one of the origins the app's CSRF check accepts. **Do not** set `AUTH_TRUST_HOST=true` instead — that trusts whatever `Host` header arrives.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `ERROR_ALERT_WEBHOOK_URL`, `CRON_HEARTBEAT_URL` — optional, for alerts (§11).
- `RESEND_API_KEY`, `EMAIL_FROM` (on the salon's domain, verified in Resend). In a production build a missing key **fails closed**: nothing is sent, nothing but "RESEND_API_KEY is not set" is logged — so the smoke test's "emails arrive" check (§9) is what catches it.

**Build time** (inlined into the build — set them in the **build** environment, e.g. Workers Builds settings or the CI job, not only as runtime secrets). `next.config.ts` refuses to build in production without them:

- `NEXT_PUBLIC_APP_URL` — the `https://` domain (email links).
- `CLOUDINARY_CLOUD_NAME` — also scopes `next/image` to the salon's own Cloudinary account.
- `AUTH_URL` — also needed at build time for the HSTS header (it's read in `next.config.ts`).

## 2. Workers configuration [M1]

The Cloudflare rate limits (§4) are WAF rules on the salon's **zone**. A Worker is also reachable at `<name>.<account>.workers.dev` and at per-version preview URLs, which are **not** part of the zone — no WAF rule applies there. Left on, every limit in §4 can be skipped by sending the same request to the `workers.dev` host.

In the Worker's Wrangler config (or the adapter's equivalent):

```jsonc
{
  "workers_dev": false,   // no <name>.<account>.workers.dev route
  "preview_urls": false,  // no per-version preview hosts
  "routes": [{ "pattern": "<domain>", "custom_domain": true }]
}
```

Check after every deploy (it's in §9): `curl -sI https://<name>.<account>.workers.dev/api/services` must fail (no route / 404), not return 200.

## 3. Database (Neon)

- **Separate projects for dev and production** (not just branches), so a dev `.env` can never hold production credentials.
- **Least-privilege runtime role [L7].** Neon's default role owns the database; if the app runs as it, any server-side bug (or a leaked `DATABASE_URL`) could `DROP` tables or the store-credit `CHECK` constraints. Create a runtime role with data access only, as the owner, after the first `migrate deploy`:

  ```sql
  CREATE ROLE app_runtime LOGIN PASSWORD '<generated>';
  GRANT CONNECT ON DATABASE neondb TO app_runtime;
  GRANT USAGE ON SCHEMA public TO app_runtime;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
  -- Tables created by future migrations (run as the owner) get the same grants:
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
  ```

  The Worker's `DATABASE_URL` uses `app_runtime`; migrations use the owner.
- **Migrations:** run `npx prisma migrate deploy` as the **owner** over Neon's **direct** (non-pooled) connection string. Every `migrate deploy` against the pooled URL has left Prisma's advisory lock held (`SELECT pg_advisory_unlock(72707369)` releases it).
- If Hyperdrive sits between the Worker and Neon, keep TLS (`sslmode=verify-full`) on the Hyperdrive → Neon leg.

**Seeding and the first admin [H1, M2]:**

1. `npx prisma db seed` with nothing set creates only the `AppSettings` row. **Never set `SEED_DEV_DATA=1` against production** — it adds demo rows and, without `SEED_ADMIN_*`, the published dev admin login (the seed refuses it if `NODE_ENV=production`, but a laptop won't have that set).
2. The salon owner registers at `/register` on the live site and **clicks the confirmation link** in the email.
3. `npm run promote-admin -- owner@email.com` (with the production `DATABASE_URL`). It refuses an unconfirmed address, prints the account's details (created, sign-in method, bookings) and asks for the email again. Check the details are the owner's.
4. Straight afterwards, the owner does **Forgot password** from their inbox and sets a new one. If anyone registered the owner's address first, this replaces their password and signs them out everywhere.
5. Confirm: `SELECT email, "emailVerified" FROM "User" WHERE role = 'ADMIN';` lists only the owner.

## 4. Rate limiting (Cloudflare WAF → Security → WAF → Rate limiting rules)

The app has no rate limiter of its own, by decision: limits are enforced at Cloudflare's edge, before requests reach the app or the database. They only cover traffic through the zone — see §2. Match on **IP address**. Suggested starting values:

| Rule | Expression (matches) | Limit | Action |
|---|---|---|---|
| Sign-in | `http.request.uri.path eq "/api/auth/callback/credentials" and http.request.method eq "POST"` | 10 requests / 1 minute | Block for 10 minutes |
| Register | `http.request.uri.path eq "/api/auth/register"` | 5 / 10 minutes | Block for 1 hour |
| Password reset | `http.request.uri.path in {"/api/auth/forgot-password" "/api/auth/reset-password"}` | 5 / 10 minutes | Block for 1 hour |
| Email verification | `http.request.uri.path in {"/api/auth/verify-email" "/api/auth/resend-verification"}` | 10 / 10 minutes | Block for 1 hour |
| Profile changes | `http.request.uri.path eq "/api/users/me" and http.request.method eq "PATCH"` | 10 / 10 minutes | Block for 1 hour |
| Availability (public) | `starts_with(http.request.uri.path, "/api/artists/") and ends_with(http.request.uri.path, "/availability")` | 120 / 1 minute | Managed Challenge |
| Booking | `http.request.uri.path in {"/api/appointments" "/api/appointments/recurring"} and http.request.method eq "POST"` | 20 / 10 minutes | Block for 10 minutes |
| Gift card redeem (customer) | `http.request.uri.path eq "/api/gift-cards/redeem"` | 5 / 10 minutes | Block for 1 hour |

Notes:
- Cloudflare's free plan allows one rate-limiting rule. If that's the plan, the **sign-in** rule matters most (password guessing), then password reset. Combine paths with `or` into one rule if needed.
- "Profile changes" matters because changing the email checks the current password — without a limit it's a password-guessing endpoint for anyone holding a session.
- Forgot-password and the verification emails already have a per-account 60-second cooldown in the app; the edge rules add the per-IP limit.
- Gift card codes carry 80 random bits, so guessing one is hopeless even unlimited; the redeem rule is defense in depth. Staff redeeming at the desk use `/api/admin/gift-cards/redeem`, which this rule doesn't touch.
- Front-desk staff share the salon's IP. If the booking limit trips during a busy day, raise it or exclude admin traffic.
- Keep Cloudflare's default of **not caching HTML**. Never add a "Cache Everything" rule: signed-in pages and `/api/*` carry personal data.

## 5. Security headers and email authentication

- **HSTS** is automatic: `next.config.ts` sends `Strict-Transport-Security: max-age=31536000; includeSubDomains` when `AUTH_URL` starts with `https://` (build-time, §1). Before go-live, make sure **every subdomain** of the domain serves HTTPS (`includeSubDomains`). Submitting to the browser preload list (`preload`) is optional, slow to undo, and deliberately not done.
- **DMARC** next to Resend's SPF/DKIM, so nobody else can send mail as the salon's domain: a DNS TXT record at `_dmarc.<domain>` with `v=DMARC1; p=quarantine; rua=mailto:<owner inbox>`. Move to `p=reject` once the reports show only Resend sending.

## 6. Timezone fix (blocker) [L6]

All date math assumes the server clock is the salon's clock. Workers run in UTC, so as built: availability windows and time off apply 4–5 hours early (a salon-wide closure entered as 09:00–18:00 blocks 04:00–13:00 New York time, leaving the **afternoon of a closed day bookable**), and "today", the 14-day window and day boundaries shift too. Online cancel/reschedule windows are unaffected (pure millisecond arithmetic).

**Approach (no library, per the project's no-timezone-library decision):**

1. Add `SALON_TIME_ZONE = "America/New_York"` in one plain module.
2. Re-implement the date helpers listed in `PROJECT_STATUS.md` (`startOfDay`, `endOfDay`, `startOfWeek`, `timeStringToDate`, `toLocalDateKey`, `parseLocalDate`, `addDays`, `generateOccurrenceDates`, plus `Date#getDay`/`getMinutes` uses in the booking routes) on top of two primitives built from `Intl.DateTimeFormat`:
   - `zonedParts(instant)` → `{ year, month, day, hour, minute, weekday }` in the salon's zone (`formatToParts` with `timeZone: SALON_TIME_ZONE`);
   - `zonedToInstant(dateKey, "HH:mm")` → the UTC instant for that wall-clock time: guess `Date.UTC(...)`, read the zone's offset at that instant from `zonedParts`, correct, and re-check once (this handles the DST changeover days).
3. Keep every caller on the helpers — the existing rule "no inline `getHours`/`setDate`/`getDay` math" is what makes this a contained change.
4. **Tests that must pass with `TZ=UTC npm test` and with `TZ=America/New_York npm test`:** a salon-wide closure blocks exactly its New York hours; slot generation for a window on the DST start and end Sundays; `toLocalDateKey` at 23:30 New York time; the 14-day window boundary.

## 7. Runtime checks on the adapter trial build

- **bcrypt CPU [L3].** `bcryptjs` (pure JS) at cost 10 spends tens to hundreds of ms of **CPU** per hash, on every sign-in, registration, reset and email change. The Workers Free plan's 10 ms CPU limit would fail every sign-in, so a **paid plan** is required. In the trial build, measure the CPU time of a sign-in (Workers Logs show CPU time per request). If it's near the plan's limit, options in order: keep cost 10 and raise the Worker's CPU limit (`limits.cpu_ms`); or move hashing to Web Crypto PBKDF2-SHA256 at OWASP's iteration count with a re-hash-on-login migration. Never lower the bcrypt cost to make it fit. The startup cost is already gone (the timing-safety dummy hash is a precomputed constant).
- **`pg` + `@prisma/adapter-pg`** connecting from Workers (via `cloudflare:sockets` or Hyperdrive), and Next's **image optimizer**: see §8.

## 8. Images and PWA

- **Image optimization:** artist photos go through `next/image` (`/_next/image`) with `res.cloudinary.com/<cloud name>/` allowed in `images.remotePatterns`. Confirm the chosen adapter supports Next's image optimizer on Workers. If it doesn't, set a Cloudinary loader in `next.config.ts` (`images.loader: "custom"` + a loader file that builds `https://res.cloudinary.com/<cloud>/image/upload/w_<width>,q_auto,f_auto/...` URLs), which moves resizing to Cloudinary.
- **PWA:** install-to-home-screen requires HTTPS. After deploy, check Chrome DevTools → Application → Manifest (no errors, icons load) and → Service Workers (`/sw.js` activated). Lighthouse's PWA checks are a good final pass.
- The service worker only registers in production builds. If its caching ever needs changing, bump `CACHE_VERSION` in `public/sw.js`.

## 9. Scheduled job

- Call `POST /api/jobs/send-reminders` hourly with `Authorization: Bearer <CRON_SECRET>`, via a Workers Cron Trigger (`0 * * * *`), a GitHub Actions cron, or a cron-pinger service.
- Set `CRON_HEARTBEAT_URL` (§11) so a scheduler that silently stops calling is noticed.

## 10. Smoke test after deploy

Functional: register → **confirm email from the inbox** → sign in → book → reschedule → cancel; change email (asks for the password; link arrives at the new address; old address gets the notice); admin: grid booking, checkout, settings save; password reset email arrives; the reminder job run returns `{ sent: n }`; open on a phone and "Add to Home Screen".

Security (each must hold):

- `curl -s https://<domain>/admin/gift-cards` and `/admin/recurring` signed out: the body contains no `@` email addresses, no `codeLast4`, no `creditBalanceCents` (C1 regression check — repeat a few times).
- `curl -sI https://<name>.<account>.workers.dev/` fails (§2).
- `curl -sI https://<domain>/` shows `Strict-Transport-Security` and `Content-Security-Policy`, and no `X-Powered-By`.
- `curl -s -X POST https://<domain>/api/auth/forgot-password -H 'Content-Type: text/plain' -d '{"email":"x@y.zz"}'` returns **415**; the same with `-H 'Origin: https://evil.example' -H 'Content-Type: application/json'` returns **403**.
- `SELECT email FROM "User" WHERE role='ADMIN'` lists only the owner; no `admin@example.com`.

Monitoring (§11): `curl -s https://<domain>/api/health` returns `{"data":{"status":"ok"}}`; the uptime monitor shows the site up; the cron heartbeat check shows a ping after the first hourly run; a test message reaches the alert channel.

## 11. Monitoring and alerts (FEATURE_GAPS.md Gap 26)

What the app already does (no vendor SDK, nothing to install):

- **Every uncaught server error** (a page that throws while rendering, a route handler that throws) goes through `onRequestError` in `src/instrumentation.ts` to `reportError()` in `src/lib/report-error.ts`. So do failed emails (`email_failed`), a reminder run with failures (`reminders_failed`) and a failed health check (`health_check_failed`). Each is **one JSON line** on stderr with `"level":"error"`, an `event` name, the path (query string removed), the route file and Next's `digest` (the code shown on the error page, so a customer's screenshot can be matched to a log line). Request headers and email recipients are never included.
- **`ERROR_ALERT_WEBHOOK_URL`** (optional runtime secret): a Slack or Discord incoming-webhook URL. Each report also posts a one-line summary there, throttled to once per kind of error per 5 minutes per Worker instance.
- **`GET /api/health`**: `200 {"data":{"status":"ok"}}` when the database answers `SELECT 1`, `503` otherwise. Public, no details, `Cache-Control: no-store`.
- **`CRON_HEARTBEAT_URL`** (optional runtime secret): pinged after each reminder run. This catches the one failure the app can't report itself — the scheduler never calling at all.

What to set up at deploy:

1. **Logs.** Turn on Workers Logs in the Wrangler config (`"observability": { "enabled": true }`). Check that a deliberate error (e.g. a request to a route with the database URL wrong, on a preview) shows up as a `"level":"error"` line you can filter on.
2. **Alert channel.** Create an incoming webhook in the salon's (or Eric's) Slack or Discord and `wrangler secret put ERROR_ALERT_WEBHOOK_URL`. Send a test: `curl -X POST "$URL" -H 'Content-Type: application/json' -d '{"text":"test","content":"test"}'`.
3. **Uptime check.** Point a free external monitor (UptimeRobot, Better Stack or similar) at `https://<domain>/api/health` every 5 minutes, alerting by email or text to whoever will act on it. Cloudflare's own Health Checks also work if the zone's plan includes them. Exclude `/api/health` from the §4 rate limits, or keep the monitor's interval well under them.
4. **Cron heartbeat.** Create an hourly check with a grace period of about 2 hours on Healthchecks.io (free tier) or a similar dead-man's-switch service, and `wrangler secret put CRON_HEARTBEAT_URL` with its ping URL.
5. **Who gets alerted.** Decide this with the client before launch: someone has to act when the site is down on a Saturday morning.

Not done (yet): no error tracking with stack traces grouped across releases (Sentry and similar). The JSON logs plus `digest` are enough at this size; revisit if errors become frequent enough that grouping matters. Sentry's Cloudflare SDK would go in `register()` in `src/instrumentation.ts`, and its CPU cost needs checking against the plan (§7).
