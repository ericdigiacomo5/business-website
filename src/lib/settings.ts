import { prisma } from "@/lib/prisma";
import { DEFAULT_POLICY, type PolicySettings } from "@/lib/recurring";

// Single source of truth for the global self-booking toggle, read by both
// booking routes (one-off and recurring) so an admin flipping it in one
// place takes effect everywhere at once. Defaults to true if the singleton
// row is somehow missing — booking staying open is the safer failure mode
// than every customer getting locked out by a missing seed row.
export async function isBookingEnabled(): Promise<boolean> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return settings?.bookingEnabled ?? true;
}

// The salon's editable policies (notice window, standing-appointment cap),
// with the same "missing row → defaults" fallback as isBookingEnabled().
export async function getPolicySettings(): Promise<PolicySettings> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { cancellationNoticeHours: true, maxSeriesWeeks: true },
  });
  return settings ?? { ...DEFAULT_POLICY };
}
