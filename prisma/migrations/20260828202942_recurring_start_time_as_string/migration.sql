-- RecurringAppointment.startTime represents a time-of-day paired with
-- dayOfWeek (a recurring rule), the same convention Availability.startTime
-- and TimeOff.startTime already use ("HH:mm" string), not a calendar
-- timestamp. Table is empty at time of writing, so no data migration needed.
ALTER TABLE "RecurringAppointment" ALTER COLUMN "startTime" TYPE TEXT USING "startTime"::TEXT;
