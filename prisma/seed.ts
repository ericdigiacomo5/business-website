import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// What gets seeded:
//   - always: the AppSettings singleton (the app needs it).
//   - SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD set: that admin.
//   - SEED_DEV_DATA=1 only: a demo artist/service/availability, and — if no
//     SEED_ADMIN_* was given — the dev admin login admin@example.com /
//     admin12345.
//
// Opt-in, not "skip in production": the guard used to be NODE_ENV ===
// "production", but the runbook's seed step runs from a laptop pointed at
// the production DATABASE_URL, where nothing sets NODE_ENV — so forgetting
// SEED_ADMIN_* created the published default admin in production. Checking
// the database host doesn't work either (dev is on Neon too). Now a
// production seed with nothing set creates only AppSettings, and the demo
// data and default credentials need an explicit flag that is refused if
// NODE_ENV is production.
const seedDevData = process.env.SEED_DEV_DATA === "1";

async function main() {
    if (seedDevData && process.env.NODE_ENV === "production") {
        throw new Error("SEED_DEV_DATA=1 is for local development only — refusing with NODE_ENV=production.");
    }

    await prisma.appSettings.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            bookingEnabled: true
        }
    })

    if (seedDevData) {
        const artist = await prisma.artist.upsert({
            where: { id: "seed-artist-libby" },
            update: {},
            create: {
                id: "seed-artist-libby",
                name: "Libby Bent",
                bio: "Does nails and stuff."
            }
        });

        await prisma.service.upsert({
            where: { id: "seed-service-mani" },
            update: {},
            create: {
                id: "seed-service-mani",
                name: "Manicure",
                description: "Gel manicure with color.",
                category: "HANDS",
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
    }

    // Upserted by email (not a fixed id, unlike the rows above) since email
    // is this row's actual unique identity — changing SEED_ADMIN_EMAIL
    // between runs means "seed a different admin," not "update the same
    // one." `update: {}` intentionally never overwrites an existing admin's
    // password/role on re-seed, matching the idempotent pattern above.
    const hasSeedAdmin = Boolean(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD);
    if (!hasSeedAdmin && !seedDevData) {
        console.log("Seeded AppSettings. No admin created (set SEED_ADMIN_*, or use `npm run promote-admin`).");
        return;
    }
    if (!hasSeedAdmin) {
        console.warn("SEED_DEV_DATA=1 without SEED_ADMIN_* — seeding the default dev admin login. Local development only.");
    }

    // Lowercased like every other stored email (see normalizeEmail in
    // src/lib/validation.ts), so sign-in finds it however it's typed.
    const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            name: "Salon Admin",
            phone: "555-0100",
            passwordHash: await bcrypt.hash(adminPassword, BCRYPT_COST),
            role: "ADMIN",
            // The operator chose this address; there's no one else to
            // confirm it.
            emailVerified: new Date(),
        },
    });

    console.log("Seeded:", { devData: seedDevData, admin: admin.email });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    })
