/*
  Warnings:

  - You are about to drop the column `endTume` on the `Availability` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `Availability` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Availability" DROP COLUMN "endTume",
ADD COLUMN     "endTime" TEXT NOT NULL;
