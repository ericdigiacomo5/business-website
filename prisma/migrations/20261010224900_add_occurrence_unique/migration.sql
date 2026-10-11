-- Hand-written: `prisma migrate dev` refuses non-interactively when adding a
-- unique constraint. Safe here because prisma/backfill-materialization.ts
-- ran first and reported zero same-day collisions.

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_recurringAppointmentId_occurrenceDate_key" ON "Appointment"("recurringAppointmentId", "occurrenceDate");
