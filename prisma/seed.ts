import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const artist = await prisma.artist.upsert({
        where: { id: "seed-artist-libby" },
        update: {},
        create: {
            id: "seed-artist-libby",
            name: "Libby Bent",
            bio: "Does nails and stuff."
        }
    });

    const service = await prisma.service.upsert({
        where: { id: "seed-service-mani" },
        update: {},
        create: {
            id: "seed-service-mani",
            name: "Manicure",
            description: "Gel manicure with color.",
            durationMinutes: 45,
            priceCents: 4500,
        }
    })

    await prisma.availability.upsert({
        where: { id: "seed-avail-libby-tue" },
        update: {},
        create: {
            id: "seed-avail-libby-tue",
            artistId: artist.id,
            dayOfWeek: 2,
            startTime: "09:00",
            endTime: "17:00"
        }
    })

    console.log("Seeded:", { artist, service });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    })