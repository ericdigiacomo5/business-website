-- Hand-written: standing appointments now require an end date and are booked
-- in full at creation, so the rolling-materialization watermark goes away.
-- `prisma migrate dev` can't make a column NOT NULL over existing null rows.

-- An open-ended series ends where its bookings already end: the watermark is
-- exactly "every week up to here has been booked or skipped".
UPDATE "RecurringAppointment"
SET "seriesEnd" = COALESCE("materializedThrough", "seriesStart")
WHERE "seriesEnd" IS NULL;

-- AlterTable
ALTER TABLE "RecurringAppointment" ALTER COLUMN "seriesEnd" SET NOT NULL,
DROP COLUMN "materializedThrough";
