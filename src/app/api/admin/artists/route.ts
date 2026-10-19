import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { isCloudinaryUrl, optionalText, requiredText, TEXT_LIMITS } from "@/lib/validation";
import { readJsonObject } from "@/lib/request";
import { isBasisPoints } from "@/lib/pay-report";
import { ARTIST_PAY_TERMS_INCLUDE, setArtistCommission } from "@/lib/pay-terms";

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
        !isCloudinaryUrl(photoUrl, process.env.CLOUDINARY_CLOUD_NAME)) {
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
        return tx.artist.findUniqueOrThrow({ where: { id: created.id }, include: ARTIST_PAY_TERMS_INCLUDE })
    })

    return Response.json(
        { data: artist },
        { status: 201 }
    )
}
