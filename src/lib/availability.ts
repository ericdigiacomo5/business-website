import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SLOT_MINUTES, getGridBounds, type ArtistWorkingWindow } from "@/lib/schedule-grid";

// Re-exported so server-side code can keep importing these from this file —
// only the schedule grid's Client Component needs to import them from
// @/lib/schedule-grid directly, to avoid pulling this file's Prisma/pg
// dependency chain into a client bundle (see that file's own comment).
export { SLOT_MINUTES, getGridBounds, type ArtistWorkingWindow };

// "HH:mm", 24-hour, zero-padded — matches what timeStringToDate() expects to parse.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

// No timezone handling yet: times are interpreted in the server's local
// timezone. Fine for now with a single-location salon, but will need
// date-fns-tz or Temporal once this runs somewhere other than the salon's
// own timezone.
export function timeStringToDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

// "Does [date, endDate ?? date] overlap [rangeStart, rangeEnd]" as a
// TimeOffWhereInput fragment — shared by getOpenSlots and both admin
// time-off routes' overlap checks, so the same date-range logic isn't
// hand-written three times (the admin/availability overlap check went
// through this exact duplication once already before being unified — see
// PROJECT_STATUS.md). A range row's relevant end is endDate when present,
// date otherwise; Prisma can't express that COALESCE directly in a filter,
// hence the inner OR.
export function timeOffDateRangeOverlap(
  rangeStart: Date,
  rangeEnd: Date
): Prisma.TimeOffWhereInput {
  return {
    AND: [
      { date: { lte: rangeEnd } },
      { OR: [{ endDate: null, date: { gte: rangeStart } }, { endDate: { gte: rangeStart } }] },
    ],
  };
}

function generateSlotsInWindow(date: Date, startTime: string, endTime: string): Date[] {
  const slots: Date[] = [];
  let current = timeStringToDate(date, startTime);
  const windowEnd = timeStringToDate(date, endTime);

  while (current < windowEnd) {
    slots.push(current);
    current = new Date(current.getTime() + SLOT_MINUTES * 60_000);
  }

  return slots;
}

export async function getOpenSlots(
  artistId: string,
  date: Date,
  options?: { allowPast?: boolean; excludeAppointmentId?: string }
): Promise<Date[]> {
  const dayOfWeek = date.getDay();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [availability, timeOff, bookedSlots] = await Promise.all([
    prisma.availability.findMany({ where: { artistId, dayOfWeek } }),
    // A row applies to this artist either directly (artistId matches) or
    // salon-wide (artistId is null — see PLAN_SALON_CLOSURES.md), combined
    // with the shared date-range overlap check.
    prisma.timeOff.findMany({
      where: {
        AND: [
          { OR: [{ artistId }, { artistId: null }] },
          timeOffDateRangeOverlap(dayStart, dayEnd),
        ],
      },
    }),
    prisma.appointmentSlot.findMany({
      where: {
        artistId,
        slotStart: { gte: dayStart, lte: dayEnd },
        // Lets a reschedule flow treat an appointment's own currently-held
        // slots as open when showing what times are available to move it
        // to — the PATCH route itself already frees these before checking
        // the new time, so hiding them here would just make the picker lie
        // about what a reschedule request would actually be allowed to do.
        ...(options?.excludeAppointmentId ? { appointmentId: { not: options.excludeAppointmentId } } : {}),
      },
    }),
  ]);

  const bookedTimes = new Set(bookedSlots.map((slot) => slot.slotStart.getTime()));

  const timeOffRanges = timeOff.map((entry) => ({
    start: timeStringToDate(date, entry.startTime),
    end: timeStringToDate(date, entry.endTime),
  }));

  const candidateSlots = availability.flatMap((window) =>
    generateSlotsInWindow(date, window.startTime, window.endTime)
  );

  const now = Date.now();
  const allowPast = options?.allowPast ?? false;

  const openSlots = candidateSlots.filter((slot) => {
    // Skipped only when an admin caller explicitly opts in (see
    // bookOccurrence) — every other caller, including the public
    // GET /api/artists/:id/availability route customers browse against,
    // keeps the default false and never sees a past slot as open.
    if (!allowPast && slot.getTime() < now) return false;
    if (bookedTimes.has(slot.getTime())) return false;
    return !timeOffRanges.some((range) => slot >= range.start && slot < range.end);
  });

  // Dedupe in case overlapping Availability rows produced the same slot twice
  // — nothing in the schema stops an admin from entering overlapping windows.
  const uniqueOpenSlots = [...new Map(openSlots.map((slot) => [slot.getTime(), slot])).values()];

  uniqueOpenSlots.sort((a, b) => a.getTime() - b.getTime());

  return uniqueOpenSlots;
}

// One batched query for all requested artists (not N+1 — the schedule grid
// always needs every artist's window for the day at once). An artist can
// have multiple Availability rows for the same dayOfWeek (nothing in the
// schema prevents overlapping windows, same caveat getOpenSlots already
// documents) — this takes the min start / max end across all of an artist's
// rows for that day, string-compared lexically, which is safe because every
// stored value is a zero-padded "HH:mm" (the same assumption isValidTimeString
// enforces elsewhere). An artist with zero rows for that day of week gets
// { start: null, end: null } rather than being omitted, so callers can
// render a distinct "off today" state instead of an indistinguishable empty one.
export async function getWorkingWindows(artistIds: string[], date: Date): Promise<ArtistWorkingWindow[]> {
  const dayOfWeek = date.getDay();

  const rows = await prisma.availability.findMany({
    where: { artistId: { in: artistIds }, dayOfWeek },
  });

  return artistIds.map((artistId) => {
    const artistRows = rows.filter((row) => row.artistId === artistId);

    if (artistRows.length === 0) {
      return { artistId, start: null, end: null };
    }

    const start = artistRows.reduce((min, row) => (row.startTime < min ? row.startTime : min), artistRows[0].startTime);
    const end = artistRows.reduce((max, row) => (row.endTime > max ? row.endTime : max), artistRows[0].endTime);

    return { artistId, start, end };
  });
}

export function isValidTimeString(s: string) {
  const isMatch = TIME_PATTERN.test(s)
  return isMatch
}

export function isGridAligned(time: string) {
  const [, minutes] = time.split(":").map(Number);
  return minutes % 15 === 0;
}
