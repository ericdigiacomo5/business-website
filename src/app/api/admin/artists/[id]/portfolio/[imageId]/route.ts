import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/require-admin";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    const forbidden = await requireAdmin()
    if (forbidden) return forbidden

    const { id: artistId, imageId } = await params

    const portfolioImage = await prisma.portfolioImage.findUnique({
        where: { id: imageId }
    })

    // Checked against both ids, not just imageId — an image id that exists
    // but belongs to a different artist should read as "not found" here
    // too, the same way appointment cancellation treats "exists, but not
    // yours" as its own case rather than silently deleting across artists.
    if (!portfolioImage || portfolioImage.artistId !== artistId) {
        return Response.json(
            { error: "Portfolio image not found" },
            { status: 404 }
        )
    }

    try {
        const deleted = await prisma.portfolioImage.delete({
            where: { id: imageId }
        })

        return Response.json({ data: deleted }, { status: 200 })
    } catch (error) {
        // Race between the findUnique above and this delete — same pattern
        // as every other item-level DELETE/PATCH route in this project.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return Response.json(
                { error: 'Portfolio image not found' },
                { status: 404 }
            )
        }

        throw error
    }
}
