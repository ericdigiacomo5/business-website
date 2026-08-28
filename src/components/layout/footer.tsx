import Link from "next/link"
import { SITE_NAME } from "@/lib/site"

export function Footer() {
    return (
        <footer className="border-t border-border bg-surface text-surface-foreground">
            <div className="mx-auto max-w-5xl px-4 py-8 text-sm">
                <p className="font-medium">{SITE_NAME}</p>
                <nav className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
                    <Link href="/services" className="hover:text-foreground">
                        Services
                    </Link>
                    <Link href="/artists" className="hover:text-foreground">
                        Artists
                    </Link>
                    <Link href="/about" className="hover:text-foreground">
                        About
                    </Link>
                    <Link href="/book" className="hover:text-foreground">
                        Book Now
                    </Link>
                </nav>
                <p className="mt-6 text-muted-foreground">
                    &copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.
                </p>
            </div>
        </footer>
    )
}
