-- Hand-written, same reason as 20260824222633_rename_pending_to_upcoming (which
-- this reverses): Prisma's auto-diff would drop the old enum value instead of
-- relabelling it. RENAME VALUE relabels in place — existing rows and the
-- column default follow automatically, no data rewrite.
ALTER TYPE "AppointmentStatus" RENAME VALUE 'UPCOMING' TO 'PENDING';
