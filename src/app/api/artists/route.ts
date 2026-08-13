import { prisma } from "@/lib/prisma"

export async function GET() {
    const artists = await prisma.artist.findMany();
    return Response.json(artists);
}

