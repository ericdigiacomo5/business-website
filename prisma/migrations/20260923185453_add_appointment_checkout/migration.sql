-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'OTHER');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod";
