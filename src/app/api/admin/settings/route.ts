import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readJsonObject } from "@/lib/request";
import { POLICY_LIMITS } from "@/lib/recurring";
import type { Prisma } from "@/generated/prisma/client";

const SETTINGS_SELECT = {
    bookingEnabled: true,
    cancellationNoticeHours: true,
    maxSeriesWeeks: true,
} as const;

export async function GET() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const settings = await prisma.appSettings.findUnique({
        where: { id: 1 },
        select: SETTINGS_SELECT,
    })

    if (!settings) {
        return Response.json(
            { error: "Could not get settings." },
            { status: 404 }
        )
    }

    return Response.json({ data: settings })
}

function isWholeNumberIn(value: unknown, limits: { min: number; max: number }): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= limits.min && value <= limits.max
}

// Every field optional — send only what changes, same PATCH convention as
// the rest of the admin API. At least one must be present.
export async function PATCH(request: Request) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { bookingEnabled, cancellationNoticeHours, maxSeriesWeeks } = body
    const data: Prisma.AppSettingsUpdateInput = {}

    if (bookingEnabled !== undefined) {
        if (typeof bookingEnabled !== "boolean") {
            return Response.json(
                { error: "bookingEnabled must be a boolean" },
                { status: 400 }
            )
        }
        data.bookingEnabled = bookingEnabled
    }

    if (cancellationNoticeHours !== undefined) {
        const limits = POLICY_LIMITS.cancellationNoticeHours
        if (!isWholeNumberIn(cancellationNoticeHours, limits)) {
            return Response.json(
                { error: `Cancellation notice must be a whole number of hours from ${limits.min} to ${limits.max}` },
                { status: 400 }
            )
        }
        data.cancellationNoticeHours = cancellationNoticeHours
    }

    if (maxSeriesWeeks !== undefined) {
        const limits = POLICY_LIMITS.maxSeriesWeeks
        if (!isWholeNumberIn(maxSeriesWeeks, limits)) {
            return Response.json(
                { error: `Standing appointment length must be a whole number of weeks from ${limits.min} to ${limits.max}` },
                { status: 400 }
            )
        }
        data.maxSeriesWeeks = maxSeriesWeeks
    }

    if (Object.keys(data).length === 0) {
        return Response.json(
            { error: "Provide bookingEnabled, cancellationNoticeHours and/or maxSeriesWeeks" },
            { status: 400 }
        )
    }

    const settings = await prisma.appSettings.findUnique({
        where: { id: 1 }
    })

    if (!settings) {
        return Response.json(
            { error: "Could not get settings." },
            { status: 404 }
        )
    }

    const updatedSettings = await prisma.appSettings.update({
        where: { id: 1 },
        data,
        select: SETTINGS_SELECT,
    })

    return Response.json({ data: updatedSettings })
}
