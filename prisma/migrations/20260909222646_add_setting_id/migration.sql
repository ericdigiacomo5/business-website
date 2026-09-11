/*
  Warnings:

  - The primary key for the `AppSettings` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "AppSettings" DROP CONSTRAINT "AppSettings_pkey",
ADD COLUMN     "id" INTEGER NOT NULL DEFAULT 1,
ADD CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id");
