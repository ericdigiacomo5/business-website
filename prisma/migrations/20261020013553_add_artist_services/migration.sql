-- Which services each artist performs (FEATURE_GAPS.md Gap 23). Additive
-- only: a new table, nothing changed on existing ones. An artist with no
-- rows performs every service, so existing artists keep working unchanged.

-- CreateTable
CREATE TABLE "ArtistService" (
    "artistId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ArtistService_pkey" PRIMARY KEY ("artistId","serviceId")
);

-- CreateIndex
CREATE INDEX "ArtistService_serviceId_idx" ON "ArtistService"("serviceId");

-- AddForeignKey
ALTER TABLE "ArtistService" ADD CONSTRAINT "ArtistService_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistService" ADD CONSTRAINT "ArtistService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
