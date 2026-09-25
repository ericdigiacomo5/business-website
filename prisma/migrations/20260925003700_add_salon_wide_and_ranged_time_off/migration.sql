-- DropForeignKey
ALTER TABLE "TimeOff" DROP CONSTRAINT "TimeOff_artistId_fkey";

-- AlterTable
ALTER TABLE "TimeOff" ADD COLUMN     "endDate" TIMESTAMP(3),
ALTER COLUMN "artistId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
