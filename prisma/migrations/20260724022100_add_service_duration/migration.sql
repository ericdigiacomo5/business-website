/*
  Warnings:

  - Added the required column `durationMinutes` to the `Service` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "description" TEXT,
ADD COLUMN     "durationMinutes" INTEGER NOT NULL;
