-- CreateTable
CREATE TABLE "ArtistPayTerms" (
    "artistId" TEXT NOT NULL,
    "commissionBasisPoints" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistPayTerms_pkey" PRIMARY KEY ("artistId")
);

-- CreateTable
CREATE TABLE "ServicePayTerms" (
    "serviceId" TEXT NOT NULL,
    "serviceFeeCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePayTerms_pkey" PRIMARY KEY ("serviceId")
);

-- CreateTable
CREATE TABLE "AppointmentPay" (
    "appointmentId" TEXT NOT NULL,
    "commissionBasisPoints" INTEGER NOT NULL,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentPay_pkey" PRIMARY KEY ("appointmentId")
);

-- CreateTable
CREATE TABLE "AppointmentServicePay" (
    "appointmentServiceId" TEXT NOT NULL,
    "serviceFeeCents" INTEGER NOT NULL,

    CONSTRAINT "AppointmentServicePay_pkey" PRIMARY KEY ("appointmentServiceId")
);

-- Hand-written: Prisma's schema language can't express CHECK constraints.
-- A rate is 0-100% in basis points; a fee is never negative.
ALTER TABLE "ArtistPayTerms" ADD CONSTRAINT "ArtistPayTerms_commissionBasisPoints_check" CHECK ("commissionBasisPoints" BETWEEN 0 AND 10000);
ALTER TABLE "AppointmentPay" ADD CONSTRAINT "AppointmentPay_commissionBasisPoints_check" CHECK ("commissionBasisPoints" BETWEEN 0 AND 10000);
ALTER TABLE "ServicePayTerms" ADD CONSTRAINT "ServicePayTerms_serviceFeeCents_check" CHECK ("serviceFeeCents" >= 0);
ALTER TABLE "AppointmentServicePay" ADD CONSTRAINT "AppointmentServicePay_serviceFeeCents_check" CHECK ("serviceFeeCents" >= 0);

-- AddForeignKey
ALTER TABLE "ArtistPayTerms" ADD CONSTRAINT "ArtistPayTerms_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePayTerms" ADD CONSTRAINT "ServicePayTerms_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentPay" ADD CONSTRAINT "AppointmentPay_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentServicePay" ADD CONSTRAINT "AppointmentServicePay_appointmentServiceId_fkey" FOREIGN KEY ("appointmentServiceId") REFERENCES "AppointmentService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
