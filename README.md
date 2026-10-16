# Nail Image Inc. — Salon Booking Platform

A mobile-first booking platform for a nail salon: customers book online (one-off or standing appointments), and staff run the day from an admin schedule. The scheduling engine is built in-house; double-booking is prevented by a database constraint, not application logic.

**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Prisma 7 · PostgreSQL (Neon) · Auth.js v5 (email/password + Google) · Resend (email) · Cloudinary (images). Deploy target: Cloudflare Workers (not yet deployed).

## Features

- **Customers:** browse services and artists, book one or more services with a chosen artist and time, set up standing appointments, manage bookings (online cancellation up to 24h ahead), reset a forgotten password, edit their profile.
- **Admins:** a day/week schedule grid; click an open time to book (including new walk-ins and backdated visits); confirm, check out (payment method + discount), cancel, mark no-show, reschedule, change length or services, and book the next visit. Also manage services, artists (with photo/portfolio uploads), working hours, time off and salon-wide closures, standing appointments, customers, and a global online-booking switch.
- **Email:** booking confirmations, reminders, cancellation/reschedule notices, receipts, password reset.

Payments are deliberately out of scope — the salon charges on its own POS terminal, and checkout here only records how a visit was paid.

## Getting started

Requirements: Node.js 20+ and a PostgreSQL database (the project uses Neon).

```bash
npm install
cp .env.example .env       # then fill in the values — see comments in the file
npx prisma migrate deploy  # apply migrations
npx prisma generate        # generate the client into src/generated/prisma
npx prisma db seed         # sample artist/service/hours + a dev admin login
npm run dev
```

Open http://localhost:3000. With no `RESEND_API_KEY` set, emails are printed to the console instead of being sent. The seed's dev admin is `admin@example.com` / `admin12345` unless `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are set (the seed refuses the defaults when `NODE_ENV=production`).

To make a real account an admin: register it through the site, then run `npm run promote-admin -- <email>`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |
| `npm run promote-admin -- <email>` | Give an existing account the ADMIN role |

There is no automated test suite yet.

## Project docs

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — current state, architecture decisions, conventions, roadmap. Start here.
- [`FEATURE_GAPS.md`](FEATURE_GAPS.md) — feature gap analysis and what's still open.
- [`AUDIT_2026-10-16.md`](AUDIT_2026-10-16.md) — latest repo review: improvements made and open questions.
- [`docs/PROJECT_HISTORY.md`](docs/PROJECT_HISTORY.md) — archived long-form build log.
- [`AGENTS.md`](AGENTS.md) — note for AI assistants: this Next.js version has breaking changes; read `node_modules/next/dist/docs/` first.

## Project layout

```
prisma/              schema, migrations, idempotent seed
src/app/             pages (customer site, /admin) and API routes (src/app/api)
src/components/      UI, grouped by area (booking, admin, account, ui, …)
src/lib/             shared logic — availability engine, booking transactions,
                     emails, validation, date helpers
src/auth.ts          Auth.js configuration
scripts/             one-off admin scripts
```
