-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" INTEGER;
