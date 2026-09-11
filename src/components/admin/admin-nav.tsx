'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

const ADMIN_LINKS = [
    { href: "/admin", label: "Bookings" },
    { href: "/admin/book", label: "Book Appointment" },
    { href: "/admin/services", label: "Services" },
    { href: "/admin/availability", label: "Availability" },
    { href: "/admin/time-off", label: "Time Off" },
]

export function AdminNav() {
    const pathname = usePathname()

    return (
        <nav className="mt-4 flex gap-4 overflow-x-auto border-b border-border">
            {ADMIN_LINKS.map((link) => {
                const active = pathname === link.href
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={
                            "shrink-0 border-b-2 px-1 pb-3 text-sm font-medium " +
                            (active
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground")
                        }
                    >
                        {link.label}
                    </Link>
                )
            })}
        </nav>
    )
}