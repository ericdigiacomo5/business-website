// Store-credit reconciliation: every user's cached balance
// (User.creditBalanceCents) must equal the sum of their ledger
// (CreditEntry.amountCents). Any mismatch is a bug. Read-only.
//
//   npm run check-credit
//
// Run it after any verification run that touched credit, and now and then
// by hand. Exits non-zero on a mismatch, so CI can use it later.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
    const [sums, users] = await Promise.all([
        prisma.creditEntry.groupBy({ by: ["userId"], _sum: { amountCents: true } }),
        prisma.user.findMany({
            where: { OR: [{ creditBalanceCents: { not: 0 } }, { creditEntries: { some: {} } }] },
            select: { id: true, email: true, creditBalanceCents: true },
        }),
    ]);

    const ledger = new Map(sums.map((row) => [row.userId, row._sum.amountCents ?? 0]));
    const mismatches = users.filter((user) => user.creditBalanceCents !== (ledger.get(user.id) ?? 0));

    console.log(`Checked ${users.length} account(s) with store credit activity.`);
    if (mismatches.length === 0) {
        console.log("OK: every cached balance matches its ledger.");
        return;
    }

    for (const user of mismatches) {
        console.error(
            `MISMATCH ${user.email}: cached ${user.creditBalanceCents}¢, ledger ${ledger.get(user.id) ?? 0}¢`
        );
    }
    process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
