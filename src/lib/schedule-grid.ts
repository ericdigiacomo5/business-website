// Pure, DB-free pieces split out of src/lib/availability.ts specifically so
// Client Components (the schedule grid) can import them without dragging in
// availability.ts's Prisma/pg dependency chain — bundling that into a client
// build breaks outright (pg/@prisma/adapter-pg use Node built-ins the
// browser bundler can't resolve). availability.ts re-exports these so
// server-side code doesn't need two import paths.

import type { Artist } from "@/generated/prisma/client";
import { zonedParts, zonedToInstant } from "@/lib/salon-time";

export const SLOT_MINUTES = 15;

// Longest a single appointment may be set to run (8 hours).
export const MAX_APPOINTMENT_MINUTES = 480;

// An appointment's own booked length. This — not its service's usual
// durationMinutes — is the truth for one appointment: an admin can set a
// different length for a client who takes longer (or shorter), and the
// AppointmentSlot rows it holds always match startTime..endTime. Accepts
// strings too, since rows that crossed a fetch() arrive as ISO strings.
export function durationMinutesOf(appointment: { startTime: Date | string; endTime: Date | string }): number {
  return (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60_000;
}

// A whole number of 15-minute slots, between one slot and the maximum.
export function isValidAppointmentLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SLOT_MINUTES &&
    value <= MAX_APPOINTMENT_MINUTES &&
    value % SLOT_MINUTES === 0
  );
}

// Choices for a length picker: every slot multiple up to 4 hours, plus the
// current value if it's longer than that.
export function appointmentLengthOptions(current: number): number[] {
  const options: number[] = [];
  for (let minutes = SLOT_MINUTES; minutes <= 240; minutes += SLOT_MINUTES) options.push(minutes);
  if (!options.includes(current)) options.push(current);
  return options.sort((a, b) => a - b);
}

export type ArtistWorkingWindow = { artistId: string; start: string | null; end: string | null };

// One blocked "HH:mm" range for one artist on the displayed day. A
// salon-wide closure (TimeOff.artistId = null) is expanded into one of these
// per artist, flagged so the grid can label it differently.
export type ArtistTimeOff = { artistId: string; start: string; end: string; salonWide: boolean };

// The admin schedule's two layouts: every artist on one day, or one artist
// across one week (Sunday–Saturday). Carried in the URL as ?view=week; day
// is the default.
export type ScheduleView = "day" | "week";

export function parseScheduleView(value: string | undefined): ScheduleView {
  return value === "week" ? "week" : "day";
}

// One column of the admin schedule grid: one artist on one day. The day
// view has one per artist; the week view has one per day, for one artist.
export type ScheduleColumn = {
  artist: Artist;
  date: Date;
  heading: string;
  // Only set in the week view — in the day view every column is the same day.
  isToday: boolean;
  // Index into the header color cycle; stays the artist's own in week view.
  colorIndex: number;
  workingWindow: ArtistWorkingWindow;
  timeOff: ArtistTimeOff[];
};

// Day boundaries and times of day are the salon's (America/New_York), not
// the server's: Workers run in UTC. Built on src/lib/salon-time.ts. A
// "date" here is the instant of the salon's midnight that day.
export function startOfDay(date: Date): Date {
  const p = zonedParts(date);
  return zonedToInstant(p.year, p.month, p.day);
}

// Sunday of the week containing `date`, at midnight — weeks run Sunday to
// Saturday, matching the admin month calendar's columns.
export function startOfWeek(date: Date): Date {
  const p = zonedParts(date);
  return zonedToInstant(p.year, p.month, p.day - p.weekday);
}

// The 1st of the month containing `date`, at midnight.
export function startOfMonth(date: Date): Date {
  const p = zonedParts(date);
  return zonedToInstant(p.year, p.month, 1);
}

// The last millisecond of the salon's day: one ms before the next midnight.
export function endOfDay(date: Date): Date {
  const p = zonedParts(date);
  return new Date(zonedToInstant(p.year, p.month, p.day + 1).getTime() - 1);
}

// The instant the salon's clock reads `time` ("HH:mm") on `date`'s day.
export function timeStringToDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const p = zonedParts(date);
  return zonedToInstant(p.year, p.month, p.day, hours, minutes);
}

// On the 15-minute booking grid: :00, :15, :30 or :45 on the salon's clock,
// with no seconds. Every booking and reschedule route checks this.
export function isOnSlotBoundary(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const p = zonedParts(date);
  return p.minute % SLOT_MINUTES === 0 && p.second === 0 && date.getTime() % 1000 === 0;
}

// Of a day's open 15-minute slots, the ones a visit of `durationMinutes` can
// start at: every slot it needs must itself be open, so it can't run past
// the artist's hours, into time off or into another booking. The same rule
// the booking routes apply (isFullyOpen in booking.ts) — shared by the
// booking wizard's time grid and getOpenDays().
export function fittingStarts(openSlots: Date[], durationMinutes: number): Date[] {
  const open = new Set(openSlots.map((slot) => slot.getTime()));
  const slotsNeeded = Math.ceil(durationMinutes / SLOT_MINUTES);

  return openSlots.filter((slot) => {
    for (let i = 0; i < slotsNeeded; i++) {
      if (!open.has(slot.getTime() + i * SLOT_MINUTES * 60_000)) return false;
    }
    return true;
  });
}

// "Morning" before noon, "Afternoon" until 5pm, "Evening" after — for
// grouping a long list of times (the booking wizard's slot grid).
export function partOfDay(date: Date): "Morning" | "Afternoon" | "Evening" {
  const hour = zonedParts(date).hour;
  return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
}

// Default range used only when NO artist has any Availability configured for
// the requested day — the schedule grid must always be renderable, never a
// hard empty state just because nobody has set up hours yet.
const FALLBACK_GRID_BOUNDS = { start: "09:00", end: "17:00" } as const;

// Pure — derives the schedule grid's overall time bounds from working
// windows only (never looks at appointments), so an artist's column bounds
// reflect their configured hours, not coincidentally where bookings happen
// to fall. Falls back to a fixed business-hours default when every artist
// has a null window that day; callers should surface that as an explicit
// "no hours configured" notice rather than silently presenting it as real data.
export function getGridBounds(windows: ArtistWorkingWindow[]): { start: string; end: string } {
  const starts = windows.map((w) => w.start).filter((s): s is string => s !== null);
  const ends = windows.map((w) => w.end).filter((e): e is string => e !== null);

  if (starts.length === 0 || ends.length === 0) {
    return { ...FALLBACK_GRID_BOUNDS };
  }

  return {
    start: starts.reduce((min, s) => (s < min ? s : min)),
    end: ends.reduce((max, e) => (e > max ? e : max)),
  };
}
