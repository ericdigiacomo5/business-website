'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

const ADMIN_LINKS = [
    { href: "/admin", label: "Bookings" },
    { href: "/admin/services", label: "Services" },
    { href: "/admin/artists", label: "Artists" },
    { href: "/admin/availability", label: "Availability" },
    { href: "/admin/time-off", label: "Time Off" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/recurring", label: "Standing Appointments" },
    { href: "/admin/gift-cards", label: "Gift Cards" },
    { href: "/admin/reports/pay", label: "Pay Report" },
    { href: "/admin/settings", label: "Settings" },
]

export function AdminNav() {
    const pathname = usePathname()

    return (
        // Horizontal, scrollable tabs on small screens; a vertical list with
        // the active link marked on its left edge from lg up (see the
        // sidebar in admin/layout.tsx).
        <nav
            aria-label="Admin"
            className="mt-4 flex gap-4 overflow-x-auto border-b border-border lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b-0 lg:border-l print:hidden"
        >
            {ADMIN_LINKS.map((link) => {
                const active = pathname === link.href
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={
                            "shrink-0 border-b-2 px-1 pb-3 text-sm font-medium lg:-ml-px lg:flex lg:min-h-11 lg:items-center lg:border-b-0 lg:border-l-2 lg:px-4 lg:pb-0 " +
                            (active
                                ? "border-primary text-primary lg:bg-surface"
                                : "border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-surface")
                        }
                    >
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    )
}