import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const settings = await prisma.appSettings.findUnique({
        where: { id: 1 }
    })

    if (!settings) {
        return Response.json(
            { error: "Could not get settings." },
            { status: 404 }
        )
    }

    return Response.json({ data: { bookingEnabled: settings.bookingEnabled } })
}

export async function PATCH(request: Request) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    let body: unknown;
    try {
        body = await request.json()
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    if (typeof body !== "object" || body === null) {
        return Response.json(
            { error: "Invalid request body" },
            { status: 400 }
        )
    }

    const { bookingEnabled } = body as Record<string, unknown>

    if (typeof bookingEnabled !== "boolean") {
        return Response.json(
            { error: "bookingEnabled must be a boolean" },
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
        data: { bookingEnabled }
    })

    return Response.json({ data: { bookingEnabled: updatedSettings.bookingEnabled } })
}