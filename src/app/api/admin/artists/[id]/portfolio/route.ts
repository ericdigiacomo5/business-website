import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { optionalText, TEXT_LIMITS } from "@/lib/validation";
import { isOwnCloudinaryUrl } from "@/lib/cloudinary-url";
import { readJsonObject } from "@/lib/request";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id: artistId } = await params

    const artist = await prisma.artist.findUnique({
        where: { id: artistId }
    })

    if (!artist) {
        return Response.json(
            { error: "Artist not found" },
            { status: 404 }
        )
    }

    const body = await readJsonObject(request)
    if (body instanceof Response) return body

    // Portfolio images only ever come from the signed Cloudinary upload.
    const { imageUrl } = body
    if (!isOwnCloudinaryUrl(imageUrl)) {
        return Response.json(
            { error: 'Image must be an uploaded image' },
            { status: 400 }
        )
    }

    const caption = optionalText(body.caption, TEXT_LIMITS.caption)
    if (!caption.ok) {
        return Response.json(
            { error: `Caption must be text of at most ${TEXT_LIMITS.caption} characters` },
            { status: 400 }
        )
    }

    const portfolioImage = await prisma.portfolioImage.create({
        data: {
            artistId,
            imageUrl,
            caption: caption.value ?? null,
        }
    })

    return Response.json(
        { data: portfolioImage },
        { status: 201 }
    )
}
