import Link from "next/link"
import { SITE_NAME } from "@/lib/site"

export function Footer() {
    return (
        <footer className="bg-foreground text-background">
            <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
                <p className="font-serif text-lg font-extrabold text-background">{SITE_NAME.toUpperCase()}</p>
                <nav className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[#a9b8c4]">
                    <Link href="/services" className="hover:text-background">
                        Services
                    </Link>
                    <Link href="/artists" className="hover:text-background">
                        Artists
                    </Link>
                    <Link href="/about" className="hover:text-background">
                        About
                    </Link>
                    <Link href="/book" className="hover:text-background">
                        Book Now
                    </Link>
                </nav>
                <p className="mt-6 text-[#6b7d8c]">
                    &copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.
                </p>
            </div>
        </footer>
    )
}
