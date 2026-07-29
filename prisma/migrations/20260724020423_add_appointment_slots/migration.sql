-- CreateTable
CREATE TABLE "AppointmenSlot" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "slotStart" TIMESTAMP(3) NOT NULL,
    "appointmentId" TEXT NOT NULL,

    CONSTRAINT "AppointmenSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmenSlot_artistId_slotStart_key" ON "AppointmenSlot"("artistId", "slotStart");

-- AddForeignKey
ALTER TABLE "AppointmenSlot" ADD CONSTRAINT "AppointmenSlot_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmenSlot" ADD CONSTRAINT "AppointmenSlot_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
