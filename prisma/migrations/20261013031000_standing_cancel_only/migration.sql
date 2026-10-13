-- Hand-written: a standing appointment can now only be cancelled (no pause,
-- no resume), so RecurringStatus loses PAUSED and Appointment loses the
-- cancelledBySeries flag that existed only so Resume could restore weeks.

-- A paused series' upcoming weeks were already freed and can no longer be
-- resumed, so it is cancelled in all but name.
UPDATE "RecurringAppointment" SET "status" = 'CANCELLED' WHERE "status" = 'PAUSED';

-- AlterEnum (Postgres can't drop an enum value in place)
CREATE TYPE "RecurringStatus_new" AS ENUM ('ACTIVE', 'CANCELLED');
ALTER TABLE "RecurringAppointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RecurringAppointment" ALTER COLUMN "status" TYPE "RecurringStatus_new" USING ("status"::text::"RecurringStatus_new");
ALTER TYPE "RecurringStatus" RENAME TO "RecurringStatus_old";
ALTER TYPE "RecurringStatus_new" RENAME TO "RecurringStatus";
DROP TYPE "RecurringStatus_old";
ALTER TABLE "RecurringAppointment" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "cancelledBySeries";
