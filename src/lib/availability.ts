import { prisma } from "@/lib/prisma";

const SLOT_MINUTES = 15;

// "HH:mm", 24-hour, zero-padded — matches what timeStringToDate() expects to parse.
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

// No timezone handling yet: times are interpreted in the server's local
// timezone. Fine for now with a single-location salon, but will need
// date-fns-tz or Temporal once this runs somewhere other than the salon's
// own timezone.
function timeStringToDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
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

export async function getOpenSlots(artistId: string, date: Date): Promise<Date[]> {
  const dayOfWeek = date.getDay();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [availability, timeOff, bookedSlots] = await Promise.all([
    prisma.availability.findMany({ where: { artistId, dayOfWeek } }),
    prisma.timeOff.findMany({
      where: { artistId, date: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.appointmentSlot.findMany({
      where: { artistId, slotStart: { gte: dayStart, lte: dayEnd } },
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

  const openSlots = candidateSlots.filter((slot) => {
    if (bookedTimes.has(slot.getTime())) return false;
    return !timeOffRanges.some((range) => slot >= range.start && slot < range.end);
  });

  // Dedupe in case overlapping Availability rows produced the same slot twice
  // — nothing in the schema stops an admin from entering overlapping windows.
  const uniqueOpenSlots = [...new Map(openSlots.map((slot) => [slot.getTime(), slot])).values()];

  uniqueOpenSlots.sort((a, b) => a.getTime() - b.getTime());

  return uniqueOpenSlots;
}

export function isValidTimeString(s: string) {
  const isMatch = TIME_PATTERN.test(s)
  return isMatch
}

export function isGridAligned(time: string) {
  const [, minutes] = time.split(":").map(Number);
  return minutes % 15 === 0;
}
