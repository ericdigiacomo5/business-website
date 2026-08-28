-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "recurringAppointmentId" TEXT;

-- CreateTable
CREATE TABLE "RecurringAppointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "intervalWeeks" INTEGER NOT NULL,
    "seriesStart" TIMESTAMP(3) NOT NULL,
    "seriesEnd" TIMESTAMP(3),
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringAppointment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecurringAppointment" ADD CONSTRAINT "RecurringAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAppointment" ADD CONSTRAINT "RecurringAppointment_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAppointment" ADD CONSTRAINT "RecurringAppointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recurringAppointmentId_fkey" FOREIGN KEY ("recurringAppointmentId") REFERENCES "RecurringAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
