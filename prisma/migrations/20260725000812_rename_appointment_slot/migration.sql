/*
  Warnings:

  - You are about to drop the `AppointmenSlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AppointmenSlot" DROP CONSTRAINT "AppointmenSlot_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmenSlot" DROP CONSTRAINT "AppointmenSlot_artistId_fkey";

-- DropTable
DROP TABLE "AppointmenSlot";

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "appointmentId" TEXT NOT NULL,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSlot_artistId_slotStart_key" ON "AppointmentSlot"("artistId", "slotStart");

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
