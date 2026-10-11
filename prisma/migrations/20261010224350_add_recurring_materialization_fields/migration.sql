-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelledBySeries" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occurrenceDate" TEXT;

-- AlterTable
ALTER TABLE "RecurringAppointment" ADD COLUMN     "materializedThrough" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RecurringSkippedOccurrence" (
    "id" TEXT NOT NULL,
    "recurringAppointmentId" TEXT NOT NULL,
    "occurrenceDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSkippedOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSkippedOccurrence_recurringAppointmentId_occurrenc_key" ON "RecurringSkippedOccurrence"("recurringAppointmentId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "RecurringSkippedOccurrence" ADD CONSTRAINT "RecurringSkippedOccurrence_recurringAppointmentId_fkey" FOREIGN KEY ("recurringAppointmentId") REFERENCES "RecurringAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
