import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";
import { optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation";
import { isOwnCloudinaryUrl } from "@/lib/cloudinary-url";
import { readJsonObject } from "@/lib/request";
import { isBasisPoints } from "@/lib/pay-report";
import { ARTIST_PAY_TERMS_INCLUDE, setArtistCommission } from "@/lib/pay-terms";
import { ARTIST_SERVICES_INCLUDE } from "@/lib/artist-services";
import { parseArtistServiceIds, setArtistServices } from "@/lib/artist-services-data";

class UnknownServiceError extends Error {}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id } = await params

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const { photoUrl, active } = body

    let name: string | undefined
    if (body.name !== undefined) {
        const parsed = requiredText(body.name, TEXT_LIMITS.artistName)
        if (parsed === null) {
            return Response.json(
                { error: 'Name is invalid' },
                { status: 400 }
            )
        }
        name = parsed
    }

    const bio = optionalText(body.bio, TEXT_LIMITS.bio)
    if (!bio.ok) {
        return Response.json(
            { error: `Bio must be text of at most ${TEXT_LIMITS.bio} characters` },
            { status: 400 }
        )
    }

    // Deactivate/reactivate both go through this same field — no separate
    // DELETE route, since a "delete" here is really just this update with
    // active: false (Artist is referenced by RESTRICT foreign keys the same
    // way Service is, so a real row deletion isn't an option once an artist
    // has any availability/appointments/etc.).
    if (active !== undefined && typeof active !== 'boolean') {
        return Response.json(
            { error: 'Active must be a boolean' },
            { status: 400 }
        )
    }

    // 4500 = 45%; null = clear it (back to "not set"). Visits already
    // checked out keep the rate they were snapshotted with.
    const { commissionBasisPoints } = body
    if (commissionBasisPoints !== undefined && commissionBasisPoints !== null && !isBasisPoints(commissionBasisPoints)) {
        return Response.json(
            { error: 'Commission must be a percentage from 0 to 100' },
            { status: 400 }
        )
    }

    // Optional: undefined = don't touch; null or [] = every service; a list
    // = only those (see src/lib/artist-services.ts).
    const serviceIds = body.serviceIds === undefined ? undefined : parseArtistServiceIds(body.serviceIds)
    if (typeof serviceIds === 'string') {
        return Response.json(
            { error: serviceIds },
            { status: 400 }
        )
    }

    const artist = await prisma.artist.findUnique({
        where: { id }
    })

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    // Photos only ever come from the signed Cloudinary upload. "" or null
    // means "no photo". The artist's current URL is accepted unchanged —
    // the edit form sends it back on every save, and an older photo from
    // before uploads were Cloudinary-only shouldn't block editing the name.
    if (
        photoUrl !== undefined && photoUrl !== null && photoUrl !== '' &&
        photoUrl !== artist.photoUrl &&
        !isOwnCloudinaryUrl(photoUrl)
    ) {
        return Response.json(
            { error: 'Photo must be an uploaded image' },
            { status: 400 }
        )
    }

    const data: Prisma.ArtistUpdateInput = {}
    if (name !== undefined) data.name = name;
    if (bio.value !== undefined) data.bio = bio.value;
    if (photoUrl !== undefined) data.photoUrl = photoUrl ? (photoUrl as string) : null;
    if (active !== undefined) data.active = active as boolean;

    try {
        const updatedArtist = await prisma.$transaction(async (tx) => {
            await tx.artist.update({
                where: { id: artist.id },
                data
            })
            if (commissionBasisPoints !== undefined) {
                await setArtistCommission(tx, artist.id, commissionBasisPoints as number | null)
            }
            if (serviceIds !== undefined && !(await setArtistServices(tx, artist.id, serviceIds))) {
                throw new UnknownServiceError()
            }
            return tx.artist.findUniqueOrThrow({
                where: { id: artist.id },
                include: { ...ARTIST_PAY_TERMS_INCLUDE, ...ARTIST_SERVICES_INCLUDE },
            })
        })

        return Response.json({ data: updatedArtist }, { status: 200 })
    } catch (error) {
        if (error instanceof UnknownServiceError) {
            return Response.json(
                { error: 'Service not found' },
                { status: 404 }
            )
        }

        // Race between the findUnique above and this update — e.g. the row
        // was removed in between. Same pattern as admin/services.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Artist not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
