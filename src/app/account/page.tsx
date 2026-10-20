import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MyProfileForm } from "@/components/account/my-profile-form"
import { MyStoreCredit } from "@/components/account/my-store-credit"
import { SignOutEverywhere } from "@/components/account/sign-out-everywhere"
import { CREDIT_ENTRY_SELECT } from "@/lib/credit-shared"
import { safeCallbackUrl, UNKNOWN_PHONE } from "@/lib/validation"

export default async function AccountPage({
    searchParams,
}: {
    // Set by the booking wizard when a customer has to finish their profile
    // before booking — after a successful save they're sent back there.
    searchParams: Promise<{ callbackUrl?: string }>
}) {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/account")
    }

    const [user, creditEntries, params] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { name: true, email: true, phone: true, creditBalanceCents: true },
        }),
        prisma.creditEntry.findMany({
            where: { userId: session.user.id },
            select: CREDIT_ENTRY_SELECT,
            orderBy: { createdAt: "desc" },
        }),
        searchParams,
    ])

    if (!user) {
        redirect("/login?callbackUrl=/account")
    }

    const initials = (user.name || user.email)
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()

    // Only a same-site path, never an arbitrary URL (same guard as /login).
    const returnTo = params.callbackUrl ? safeCallbackUrl(params.callbackUrl) : null

    return (
        <div className="mx-auto max-w-2xl px-4 py-14">
            <div className="mb-10 flex flex-wrap items-center gap-5">
                <div className="flex h-20 w-20 flex-none items-center justify-center rounded-full border-2 border-accent bg-muted text-xl font-semibold text-accent">
                    {initials}
                </div>
                <div>
                    <span className="font-script text-xl text-lacquer">Hello,</span>
                    <h1 className="mt-0.5 font-serif text-3xl font-extrabold text-foreground">
                        {user.name || user.email}
                    </h1>
                </div>
            </div>
            <MyProfileForm
                // The placeholder phone (accounts older than the phone
                // field) shows as an empty
                // field to fill in, not the literal word "UNKNOWN".
                initial={{
                    name: user.name ?? "",
                    email: user.email,
                    phone: user.phone === UNKNOWN_PHONE ? "" : user.phone,
                }}
                returnTo={returnTo}
            />
            <MyStoreCredit initialBalanceCents={user.creditBalanceCents} initialEntries={creditEntries} />
            <SignOutEverywhere />
        </div>
    )
}
