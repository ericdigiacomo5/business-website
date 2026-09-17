import { prisma } from "@/lib/prisma"

export async function GET() {
    const artists = await prisma.artist.findMany({ where: { active: true } });
    return Response.json(artists);
}

