import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

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

    await prisma.appSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            bookingEnabled: true
        }
    })


    // Dev-convenience admin login — NOT for production. Falls back to a
    // clearly-labeled default if SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD aren't
    // set, so `npx prisma db seed` gives a working /admin login out of the
    // box locally. Upserted by email (not a fixed id, unlike the rows above)
    // since email is this row's actual unique identity — changing
    // SEED_ADMIN_EMAIL between runs means "seed a different admin," not
    // "update the same one." `update: {}` intentionally never overwrites an
    // existing admin's password/role on re-seed, matching the idempotent
    // pattern used everywhere else in this file.
    // Hard failure rather than a warning outside development: these defaults
    // are published in the repo, so seeding them into a real database creates
    // a full-privilege account whose credentials anyone who has read the code
    // already knows. A warning is easy to miss in CI or deploy output — the
    // only safe default is to refuse.
    if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must both be set when seeding outside development. Refusing to create a default admin account."
            );
        }
        console.warn(
            "No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — seeding the default dev admin login. Never use this outside local development."
        );
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            phone: "555-0100",
            passwordHash: await bcrypt.hash(adminPassword, 10),
            role: "ADMIN",
        },
    });

    console.log("Seeded:", { artist, service, admin: admin.email });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    })