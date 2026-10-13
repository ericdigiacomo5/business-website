-- Hand-written around Prisma's generated DDL: an appointment (and a standing
-- appointment) can now have several services, so the single serviceId column
-- on each becomes a line table. The auto-diff would drop serviceId before
-- anything had copied it; this creates the tables, backfills one line per
-- existing row, and only then drops the columns.

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringAppointmentService" (
    "id" TEXT NOT NULL,
    "recurringAppointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RecurringAppointmentService_pkey" PRIMARY KEY ("id")
);

-- Backfill: every existing appointment gets its one service as line 0. The
-- price and duration recorded are the service's current ones — the best
-- available, since nothing stored what each appointment was booked at before
-- now. (The appointment's own startTime/endTime are untouched, so a length an
-- admin set by hand is preserved.) Ids only need to be unique; rows created
-- by the app from here on get cuids.
INSERT INTO "AppointmentService" ("id", "appointmentId", "serviceId", "position", "priceCents", "durationMinutes")
SELECT 'as_' || a."id", a."id", a."serviceId", 0, s."priceCents", s."durationMinutes"
FROM "Appointment" a
JOIN "Service" s ON s."id" = a."serviceId";

INSERT INTO "RecurringAppointmentService" ("id", "recurringAppointmentId", "serviceId", "position")
SELECT 'ras_' || r."id", r."id", r."serviceId", 0
FROM "RecurringAppointment" r;

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentService_appointmentId_serviceId_key" ON "AppointmentService"("appointmentId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringAppointmentService_recurringAppointmentId_serviceI_key" ON "RecurringAppointmentService"("recurringAppointmentId", "serviceId");

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAppointmentService" ADD CONSTRAINT "RecurringAppointmentService_recurringAppointmentId_fkey" FOREIGN KEY ("recurringAppointmentId") REFERENCES "RecurringAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAppointmentService" ADD CONSTRAINT "RecurringAppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only now that every row has been copied:

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringAppointment" DROP CONSTRAINT "RecurringAppointment_serviceId_fkey";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "serviceId";

-- AlterTable
ALTER TABLE "RecurringAppointment" DROP COLUMN "serviceId";
