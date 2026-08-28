'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { Menu, X } from "lucide-react"
import { SITE_NAME } from "@/lib/site"
import { buttonVariants } from "@/components/ui/button"

const NAV_LINKS = [
    { href: "/services", label: "Services" },
    { href: "/artists", label: "Artists" },
    { href: "/about", label: "About" },
]

export function Header() {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"
    const [isOpen, setIsOpen] = useState(false)

    const closeMenu = () => setIsOpen(false)

    return (
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
                <Link
                    href="/"
                    onClick={closeMenu}
                    className="flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                    <img src="/nail-image.jpg" alt="" className="h-8 w-8 rounded-full object-cover" />
                    {SITE_NAME}
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={
                                pathname === link.href
                                    ? "text-sm font-medium text-primary"
                                    : "text-sm font-medium text-foreground hover:text-primary"
                            }
                        >
                            {link.label}
                        </Link>
                    ))}
                    {status === "authenticated" && (
                        <Link
                            href="/appointments"
                            className={
                                pathname === "/appointments"
                                    ? "text-sm font-medium text-primary"
                                    : "text-sm font-medium text-foreground hover:text-primary"
                            }
                        >
                            My Bookings
                        </Link>
                    )}
                    {isAdmin && (
                        <Link
                            href="/admin"
                            className={
                                pathname === "/admin" || pathname.startsWith("/admin/")
                                    ? "text-sm font-medium text-primary"
                                    : "text-sm font-medium text-foreground hover:text-primary"
                            }
                        >
                            Admin
                        </Link>
                    )}
                    {status === "authenticated" ? (
                        <button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="text-sm font-medium text-foreground hover:text-primary"
                        >
                            Sign Out
                        </button>
                    ) : (
                        <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary">
                            Sign In
                        </Link>
                    )}
                    <Link href="/book" className={buttonVariants({ size: "md" })}>
                        Book Now
                    </Link>
                </nav>

                <button
                    onClick={() => setIsOpen((open) => !open)}
                    className="flex h-11 w-11 items-center justify-center md:hidden"
                    aria-label={isOpen ? "Close menu" : "Open menu"}
                    aria-expanded={isOpen}
                >
                    {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {isOpen && (
                <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMenu}
                            className="flex h-11 items-center text-base font-medium text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                    {status === "authenticated" && (
                        <Link
                            href="/appointments"
                            onClick={closeMenu}
                            className="flex h-11 items-center text-base font-medium text-foreground"
                        >
                            My Bookings
                        </Link>
                    )}
                    {isAdmin && (
                        <Link
                            href="/admin"
                            onClick={closeMenu}
                            className="flex h-11 items-center text-base font-medium text-foreground"
                        >
                            Admin
                        </Link>
                    )}
                    {status === "authenticated" ? (
                        <button
                            onClick={() => {
                                closeMenu()
                                signOut({ callbackUrl: "/" })
                            }}
                            className="flex h-11 items-center text-left text-base font-medium text-foreground"
                        >
                            Sign Out
                        </button>
                    ) : (
                        <Link
                            href="/login"
                            onClick={closeMenu}
                            className="flex h-11 items-center text-base font-medium text-foreground"
                        >
                            Sign In
                        </Link>
                    )}
                    <Link
                        href="/book"
                        onClick={closeMenu}
                        className={buttonVariants({ size: "md", className: "mt-2 w-full" })}
                    >
                        Book Now
                    </Link>
                </nav>
            )}
        </header>
    )
}
