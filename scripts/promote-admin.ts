// Real production bootstrap for the first admin account: the salon owner
// registers normally through /register like any customer and confirms
// their email, then the developer runs this once
// (`npm run promote-admin -- owner@email.com`) to flip their role. There's
// no in-app way to do this — a self-service "make me an admin" flow would
// defeat the point of the role gate.
//
// Guards against promoting the wrong account. Registration only proves
// someone typed an address, so before launch anyone could register the
// owner's address with their own password (SECURITY_AUDIT M2):
//   - the email must be verified — the owner clicked the signup link, or
//     did a password reset, which replaces any squatter's password;
//   - the account's details are printed, and the email must be typed again
//     to confirm;
//   - promotion signs the account out everywhere, so the new admin role
//     starts from a fresh sign-in.
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    // Emails are stored lowercased (see normalizeEmail in src/lib/validation.ts).
    const email = process.argv[2]?.trim().toLowerCase();

    if (!email) {
        console.error("Usage: npm run promote-admin -- <email>");
        process.exit(1);
    }

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            _count: { select: { appointments: true } },
        },
    });

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

    if (!user.emailVerified) {
        console.error(
            `${email} hasn't confirmed its email address. Have the owner click the link from the signup email ` +
                `(or use "Forgot password" from that inbox, which also confirms it), then run this again.`
        );
        process.exit(1);
    }

    console.log("About to make this account an ADMIN:");
    console.log(`  Name:           ${user.name ?? "(none)"}`);
    console.log(`  Email:          ${user.email} (confirmed ${user.emailVerified.toISOString()})`);
    console.log(`  Phone:          ${user.phone}`);
    console.log(`  Created:        ${user.createdAt.toISOString()}`);
    console.log(`  Can sign in:    ${user.passwordHash ? "yes (password)" : "no (walk-in record)"}`);
    console.log(`  Appointments:   ${user._count.appointments}`);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const typed = (await rl.question("Type the email again to confirm: ")).trim().toLowerCase();
    rl.close();
    if (typed !== email) {
        console.error("Didn't match — nothing changed.");
        process.exit(1);
    }

    const updated = await prisma.user.update({
        where: { email },
        data: { role: "ADMIN", sessionsRevokedAt: new Date() },
    });

    console.log(`${updated.email} is now an admin. Existing sessions were signed out — sign in again.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
