-- Adds NO_SHOW to the AppointmentStatus enum (FEATURE_GAPS.md Gap 8).
--
-- Hand-written rather than a plain `prisma migrate dev` auto-diff for the
-- same reason as the PENDING -> UPCOMING migration: Postgres requires
-- ALTER TYPE ... ADD VALUE to run outside a transaction block in some
-- versions/drivers, and this project already has a working precedent for
-- hand-authoring enum migrations and applying them with `prisma migrate
-- deploy`. Unlike that rename, this is a pure addition with no existing rows
-- to relabel, so there's no data-loss risk to design around.
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';
