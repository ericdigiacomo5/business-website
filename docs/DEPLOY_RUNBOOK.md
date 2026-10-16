# Deploy Runbook (Cloudflare Workers)

Steps to apply when the site first goes live. Nothing here is done yet; the deploy itself is Roadmap item 1 in `PROJECT_STATUS.md`. Blockers that must be solved first, in that order: the **salon timezone fix** (Workers run in UTC) and choosing and trial-building the **Next.js adapter** (vinext vs OpenNext).

## 1. Environment

- Set every variable in `.env.example` in the Workers environment. Generate a **new** `AUTH_SECRET` and `CRON_SECRET` for production; don't reuse the dev ones.
- `DATABASE_URL`: keep `sslmode=verify-full`.
- `NEXT_PUBLIC_APP_URL`: the real `https://` domain (used in email links).
- **`AUTH_URL`: the same `https://` domain.** Required: in a production build, Auth.js rejects every sign-in and session request with `UntrustedHost` unless `AUTH_URL` is set (or `AUTH_TRUST_HOST=true`, which trusts whatever `Host` header arrives — only safe behind a proxy that sets it). Found on 2026-10-16 by running `next start` locally; dev mode doesn't enforce this, so it never showed up before.
- `EMAIL_FROM` on the salon's own domain, with that domain verified in Resend (SPF + DKIM DNS records).
- Point Prisma migrations at Neon's **direct** (non-pooled) connection string. Every `migrate deploy` against the pooled URL has left Prisma's advisory lock held (`SELECT pg_advisory_unlock(72707369)` releases it).
- Run `npx prisma migrate deploy`, then seed with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` set (the seed refuses the defaults in production), or skip the seed admin and use `npm run promote-admin -- <email>`.

## 2. Rate limiting (Cloudflare WAF → Security → WAF → Rate limiting rules)

The app has no rate limiter of its own, by decision: limits are enforced at Cloudflare's edge, before requests reach the app or the database. Match on **IP address**. Suggested starting values:

| Rule | Expression (matches) | Limit | Action |
|---|---|---|---|
| Sign-in | `http.request.uri.path eq "/api/auth/callback/credentials" and http.request.method eq "POST"` | 10 requests / 1 minute | Block for 10 minutes |
| Register | `http.request.uri.path eq "/api/auth/register"` | 5 / 10 minutes | Block for 1 hour |
| Password reset | `http.request.uri.path in {"/api/auth/forgot-password" "/api/auth/reset-password"}` | 5 / 10 minutes | Block for 1 hour |
| Availability (public) | `starts_with(http.request.uri.path, "/api/artists/") and ends_with(http.request.uri.path, "/availability")` | 120 / 1 minute | Managed Challenge |
| Booking | `http.request.uri.path in {"/api/appointments" "/api/appointments/recurring"} and http.request.method eq "POST"` | 20 / 10 minutes | Block for 10 minutes |

Notes:
- Cloudflare's free plan allows one rate-limiting rule. If that's the plan, the **sign-in** rule matters most (password guessing), then password reset. Combine paths with `or` into one rule if needed.
- Forgot-password already has a per-email 60-second cooldown in the app; the edge rule adds the per-IP limit.
- Front-desk staff share the salon's IP. If the booking limit trips during a busy day, raise it or exclude admin traffic.

## 3. Security headers

- Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to `next.config.ts`'s header list once the domain is HTTPS-only (deliberately omitted for local dev).

## 4. Scheduled job

- Call `POST /api/jobs/send-reminders` hourly with `Authorization: Bearer <CRON_SECRET>`, via a Workers Cron Trigger (`0 * * * *`), a GitHub Actions cron, or a cron-pinger service.

## 5. Images and PWA

- **Image optimization:** artist photos go through `next/image` (`/_next/image`) with `res.cloudinary.com` allowed in `images.remotePatterns`. Confirm the chosen adapter supports Next's image optimizer on Workers. If it doesn't, set a Cloudinary loader in `next.config.ts` (`images.loader: "custom"` + a loader file that builds `https://res.cloudinary.com/<cloud>/image/upload/w_<width>,q_auto,f_auto/...` URLs), which moves resizing to Cloudinary.
- **PWA:** install-to-home-screen requires HTTPS. After deploy, check Chrome DevTools → Application → Manifest (no errors, icons load) and → Service Workers (`/sw.js` activated). Lighthouse's PWA checks are a good final pass.
- The service worker only registers in production builds. If its caching ever needs changing, bump `CACHE_VERSION` in `public/sw.js`.

## 6. Smoke test after deploy

Register → sign in → book → reschedule → cancel; admin: grid booking, checkout, settings save; password reset email arrives; the reminder job run returns `{ sent: n }`; open on a phone and "Add to Home Screen".
