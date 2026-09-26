// Pure, DB-free pieces split out of src/lib/availability.ts specifically so
// Client Components (the schedule grid) can import them without dragging in
// availability.ts's Prisma/pg dependency chain — bundling that into a client
// build breaks outright (pg/@prisma/adapter-pg use Node built-ins the
// browser bundler can't resolve). availability.ts re-exports these so
// server-side code doesn't need two import paths.

export const SLOT_MINUTES = 15;

export type ArtistWorkingWindow = { artistId: string; start: string | null; end: string | null };

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
