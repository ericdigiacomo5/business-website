// Real production bootstrap for the first admin account: the salon owner
// registers normally through /register like any customer, then the
// developer runs this once (`npm run promote-admin -- owner@email.com`) to
// flip their role. There's no in-app way to do this — a self-service "make
// me an admin" flow would defeat the point of the role gate.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("Usage: npm run promote-admin -- <email>");
        process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.error(
            `No account found for ${email}. They need to register first at /register, then run this again.`
        );
        process.exit(1);
    }

    if (user.role === "ADMIN") {
        console.log(`${email} is already an admin.`);
        return;
    }

    const updated = await prisma.user.update({
        where: { email },
        data: { role: "ADMIN" },
    });

    console.log(`${updated.email} is now an admin.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });