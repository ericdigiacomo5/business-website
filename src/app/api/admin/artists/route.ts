import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation";
import { isOwnCloudinaryUrl } from "@/lib/cloudinary-url";
import { readJsonObject } from "@/lib/request";
import { isBasisPoints } from "@/lib/pay-report";
import { ARTIST_PAY_TERMS_INCLUDE, setArtistCommission } from "@/lib/pay-terms";
import { ARTIST_SERVICES_INCLUDE } from "@/lib/artist-services";
import { parseArtistServiceIds, setArtistServices } from "@/lib/artist-services-data";

class UnknownServiceError extends Error {}

export async function POST(request: Request) {
    const notAuthorized = await requireAdmin()
    if (notAuthorized) {
        return notAuthorized
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    const name = requiredText(body.name, TEXT_LIMITS.artistName)
    if (name === null) {
        return Response.json(
            { error: 'Name is required' },
            { status: 400 }
        )
    }

    const bio = optionalText(body.bio, TEXT_LIMITS.bio)
    if (!bio.ok) {
        return Response.json(
            { error: `Bio must be text of at most ${TEXT_LIMITS.bio} characters` },
            { status: 400 }
        )
    }

    // Photos only ever come from the signed Cloudinary upload. "" or null
    // means "no photo".
    const { photoUrl } = body
    if (photoUrl !== undefined && photoUrl !== null && photoUrl !== '' &&
        !isOwnCloudinaryUrl(photoUrl)) {
        return Response.json(
            { error: 'Photo must be an uploaded image' },
            { status: 400 }
        )
    }

    // Optional: 4500 = 45%. Omitted or null = not set yet.
    const { commissionBasisPoints } = body
    if (commissionBasisPoints !== undefined && commissionBasisPoints !== null && !isBasisPoints(commissionBasisPoints)) {
        return Response.json(
            { error: 'Commission must be a percentage from 0 to 100' },
            { status: 400 }
        )
    }

    // Optional: the services this artist performs. Omitted, null or [] =
    // every service (see src/lib/artist-services.ts).
    const serviceIds = body.serviceIds === undefined ? [] : parseArtistServiceIds(body.serviceIds)
    if (typeof serviceIds === 'string') {
        return Response.json(
            { error: serviceIds },
            { status: 400 }
        )
    }

    try {
        const artist = await prisma.$transaction(async (tx) => {
            const created = await tx.artist.create({
                data: {
                    name,
                    bio: bio.value ?? null,
                    photoUrl: photoUrl ? (photoUrl as string) : null,
                }
            })
            if (typeof commissionBasisPoints === 'number') {
                await setArtistCommission(tx, created.id, commissionBasisPoints)
            }
            if (!(await setArtistServices(tx, created.id, serviceIds))) {
                throw new UnknownServiceError()
            }
            return tx.artist.findUniqueOrThrow({
                where: { id: created.id },
                include: { ...ARTIST_PAY_TERMS_INCLUDE, ...ARTIST_SERVICES_INCLUDE },
            })
        })

        return Response.json(
            { data: artist },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof UnknownServiceError) {
            return Response.json(
                { error: 'Service not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
