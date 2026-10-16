-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "cancellationNoticeHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "maxSeriesWeeks" INTEGER NOT NULL DEFAULT 52;
