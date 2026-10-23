import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SLOT_MINUTES, getGridBounds, timeStringToDate, startOfDay, endOfDay, fittingStarts, type ArtistTimeOff, type ArtistWorkingWindow } from "@/lib/schedule-grid";
import { addDays } from "@/lib/recurring";
import { toLocalDateKey } from "@/lib/format";
import { salonWeekday } from "@/lib/salon-time";

// Re-exported so server-side code can keep importing these from this file —
// only a Client Component (the schedule grid, RecurringSeriesRow, and the
// booking window in src/lib/recurring.ts) needs to import them from
// @/lib/schedule-grid directly, to avoid pulling this file's Prisma/pg
// dependency chain into a client bundle (see that file's own comment).
export { SLOT_MINUTES, getGridBounds, timeStringToDate, startOfDay, endOfDay, type ArtistTimeOff, type ArtistWorkingWindow };

// "HH:mm", 24-hour, zero-padded — matches what timeStringToDate() expects to parse.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

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

type WindowRow = { startTime: string; endTime: string };
type TimeOffRow = { date: Date; endDate: Date | null; startTime: string; endTime: string };

// Loads everything open-slot math needs for one artist over [rangeStart,
// rangeEnd] in three queries — shared by getOpenSlots (one day) and
// getOpenDays (a window of days), so both apply exactly the same rules.
async function loadSlotInputs(
  artistId: string,
  rangeStart: Date,
  rangeEnd: Date,
  options: { dayOfWeek?: number; excludeAppointmentId?: string }
) {
  const [availability, timeOff, bookedSlots] = await Promise.all([
    prisma.availability.findMany({
      where: { artistId, ...(options.dayOfWeek !== undefined ? { dayOfWeek: options.dayOfWeek } : {}) },
    }),
    // A row applies to this artist either directly (artistId matches) or
    // salon-wide (artistId is null — see PLAN_SALON_CLOSURES.md), combined
    // with the shared date-range overlap check.
    prisma.timeOff.findMany({
      where: {
        AND: [
          { OR: [{ artistId }, { artistId: null }] },
          timeOffDateRangeOverlap(rangeStart, rangeEnd),
        ],
      },
    }),
    prisma.appointmentSlot.findMany({
      where: {
        artistId,
        slotStart: { gte: rangeStart, lte: rangeEnd },
        // Lets a reschedule flow treat an appointment's own currently-held
        // slots as open when showing what times are available to move it
        // to — the PATCH route itself already frees these before checking
        // the new time, so hiding them here would just make the picker lie
        // about what a reschedule request would actually be allowed to do.
        ...(options.excludeAppointmentId ? { appointmentId: { not: options.excludeAppointmentId } } : {}),
      },
      select: { slotStart: true },
    }),
  ]);

  return { availability, timeOff, bookedTimes: new Set(bookedSlots.map((slot) => slot.slotStart.getTime())) };
}

// Does this time-off row cover `date` at all? (Its hours are applied
// separately.) The JS twin of timeOffDateRangeOverlap, for rows already
// loaded for a wider range.
function timeOffAppliesOn(row: TimeOffRow, date: Date): boolean {
  return row.date.getTime() <= endOfDay(date).getTime() && (row.endDate ?? row.date).getTime() >= startOfDay(date).getTime();
}

// The pure part of getOpenSlots: `windows` are the artist's availability rows
// for this weekday and `timeOff` the rows that apply on this date.
function computeOpenSlots(
  date: Date,
  windows: WindowRow[],
  timeOff: TimeOffRow[],
  bookedTimes: Set<number>,
  allowPast: boolean
): Date[] {
  const timeOffRanges = timeOff.map((entry) => ({
    start: timeStringToDate(date, entry.startTime),
    end: timeStringToDate(date, entry.endTime),
  }));

  const candidateSlots = windows.flatMap((window) =>
    generateSlotsInWindow(date, window.startTime, window.endTime)
  );

  const now = Date.now();

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

export async function getOpenSlots(
  artistId: string,
  date: Date,
  options?: { allowPast?: boolean; excludeAppointmentId?: string }
): Promise<Date[]> {
  const { availability, timeOff, bookedTimes } = await loadSlotInputs(artistId, startOfDay(date), endOfDay(date), {
    dayOfWeek: salonWeekday(date),
    excludeAppointmentId: options?.excludeAppointmentId,
  });
  return computeOpenSlots(date, availability, timeOff, bookedTimes, options?.allowPast ?? false);
}

// The days among `days` consecutive days from `from` on which this artist
// has at least one start time where `durationMinutes` fits, each with the
// first such time — for the booking strip's greyed-out days and "next
// opening" (FEATURE_GAPS.md U6) and the artist cards (U12). Three queries
// for the whole window, then the same rules as getOpenSlots per day. Never
// offers past times (public callers only).
export async function getOpenDays(
  artistId: string,
  from: Date,
  days: number,
  durationMinutes: number,
  options?: { excludeAppointmentId?: string }
): Promise<{ dateKey: string; firstStart: Date }[]> {
  const dates = Array.from({ length: days }, (_, i) => addDays(startOfDay(from), i));
  const { availability, timeOff, bookedTimes } = await loadSlotInputs(
    artistId,
    dates[0],
    endOfDay(dates[dates.length - 1]),
    { excludeAppointmentId: options?.excludeAppointmentId }
  );

  return dates.flatMap((date) => {
    const windows = availability.filter((row) => row.dayOfWeek === salonWeekday(date));
    if (windows.length === 0) return [];
    const open = computeOpenSlots(date, windows, timeOff.filter((row) => timeOffAppliesOn(row, date)), bookedTimes, false);
    const [first] = fittingStarts(open, durationMinutes);
    return first ? [{ dateKey: toLocalDateKey(date), firstStart: first }] : [];
  });
}

// Each artist's next bookable time within the booking window for a visit of
// `durationMinutes` (the shortest service), or null if fully booked.
export async function getNextOpenings(
  artistIds: string[],
  durationMinutes: number,
  days: number
): Promise<Record<string, Date | null>> {
  const results = await Promise.all(
    artistIds.map(async (artistId) => {
      const [first] = await getOpenDays(artistId, new Date(), days, durationMinutes);
      return [artistId, first?.firstStart ?? null] as const;
    })
  );
  return Object.fromEntries(results);
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
  const dayOfWeek = salonWeekday(date);

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

// Time off that applies to each requested artist on `date`, for drawing on
// the admin schedule grid. Same matching rule getOpenSlots uses to block
// slots — a row applies directly (artistId) or salon-wide (artistId null),
// combined with the shared date-range overlap — so what the grid shades is
// exactly what booking refuses. One batched query, like getWorkingWindows.
export async function getTimeOffForDay(artistIds: string[], date: Date): Promise<ArtistTimeOff[]> {
  const rows = await prisma.timeOff.findMany({
    where: {
      AND: [
        { OR: [{ artistId: { in: artistIds } }, { artistId: null }] },
        timeOffDateRangeOverlap(startOfDay(date), endOfDay(date)),
      ],
    },
    orderBy: { startTime: "asc" },
  });

  return rows.flatMap((row) =>
    (row.artistId === null ? artistIds : [row.artistId]).map((artistId) => ({
      artistId,
      start: row.startTime,
      end: row.endTime,
      salonWide: row.artistId === null,
    }))
  );
}

export function isValidTimeString(s: string) {
  const isMatch = TIME_PATTERN.test(s)
  return isMatch
}

export function isGridAligned(time: string) {
  const [, minutes] = time.split(":").map(Number);
  return minutes % 15 === 0;
}
