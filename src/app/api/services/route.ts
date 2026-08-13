import { prisma } from "@/lib/prisma"

export async function GET() {
    const services = await prisma.service.findMany({
        where: { active: true }
    });

    return Response.json(services)
}
