'use client'

import { usePathname } from "next/navigation"
import { Footer } from "./footer"

// Focused task flows (currently just the booking wizard) suppress the
// marketing footer — same reasoning most booking/checkout flows use
// (Calendly, Airbnb checkout, Stripe Checkout): fewer exit points while the
// user is mid-task, and it stops the footer from competing with a fixed
// bottom action bar for the same screen real estate on short steps.
const HIDE_FOOTER_ROUTES = ["/book"]

export function FooterGate() {
    const pathname = usePathname()
    const hide = HIDE_FOOTER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))

    if (hide) return null

    return <Footer />
}