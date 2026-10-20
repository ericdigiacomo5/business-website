'use client'

import { usePathname } from "next/navigation"

// Focused task flows (currently just the booking wizard) suppress the
// marketing footer — same reasoning most booking/checkout flows use
// (Calendly, Airbnb checkout, Stripe Checkout): fewer exit points while the
// user is mid-task, and it stops the footer from competing with a fixed
// bottom action bar for the same screen real estate on short steps.
//
// The footer itself arrives as `children`, rendered by the root layout: it's
// a Server Component (it reads the opening hours), which a client module
// can't import.
const HIDE_FOOTER_ROUTES = ["/book"]

export function FooterGate({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const hide = HIDE_FOOTER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

    if (hide) return null

    return <>{children}</>
}
