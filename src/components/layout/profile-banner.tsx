'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

// Shown to a signed-in user whose account is missing a name or a real phone
// number (older self-registered accounts; Google sign-ups get a placeholder
// phone). Customers can't book online until it's fixed, so this tells them
// before they find out at the end of the booking wizard. Hidden on the
// profile page itself. Clears automatically once the profile is saved —
// profileIncomplete is recomputed from the database on every request.
export function ProfileBanner() {
    const pathname = usePathname()
    const { data: session } = useSession()

    if (!session?.user?.profileIncomplete || pathname === "/account") return null

    return (
        <div role="status" className="border-b border-foreground bg-primary/20 print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm text-foreground">
                <span>Please add your name and phone number so the salon can reach you about your bookings.</span>
                <Link
                    href="/account"
                    className="inline-flex h-11 items-center font-semibold text-accent underline underline-offset-2"
                >
                    Complete your profile
                </Link>
            </div>
        </div>
    )
}
