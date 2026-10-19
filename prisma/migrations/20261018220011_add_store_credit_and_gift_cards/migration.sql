-- Store credit, gift cards, and Groupon as a payment method.
-- Generated with `prisma migrate diff`, plus the hand-written CHECK
-- constraints at the bottom (Prisma's schema language can't express them).

-- CreateEnum
CREATE TYPE "CreditEntryKind" AS ENUM ('GIFT_CARD', 'SPENT', 'REVERSED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ISSUED', 'REDEEMED', 'VOID');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'GROUPON';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "creditAppliedCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" "CreditEntryKind" NOT NULL,
    "giftCardId" TEXT,
    "appointmentId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeLast4" TEXT NOT NULL,
    "valueCents" INTEGER NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ISSUED',
    "purchaserName" TEXT,
    "recipientName" TEXT,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_codeHash_key" ON "GiftCard"("codeHash");

-- CreateIndex
CREATE INDEX "GiftCard_issuedAt_idx" ON "GiftCard"("issuedAt");

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: the database's last line of defense for money the salon
-- owes. src/lib/credit.ts already debits with a conditional update; these
-- catch any future code path that forgets to.
ALTER TABLE "User" ADD CONSTRAINT "User_creditBalanceCents_nonnegative" CHECK ("creditBalanceCents" >= 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_creditAppliedCents_nonnegative" CHECK ("creditAppliedCents" >= 0);
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_valueCents_positive" CHECK ("valueCents" > 0);
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_amountCents_nonzero" CHECK ("amountCents" <> 0);
