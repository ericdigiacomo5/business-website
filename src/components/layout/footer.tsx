import Link from "next/link"
import { Clock, ExternalLink, MapPin, Phone, Mail } from "lucide-react"
import { SALON_CONTACT, SITE_NAME, formatPhone, mapUrl } from "@/lib/site"
import { getSalonHours } from "@/lib/salon-hours"
import { formatTimeOfDay } from "@/lib/format"
import { DecoRule } from "@/components/ui/deco"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// The local-business footer (FEATURE_GAPS.md U9): where, when, how to reach
// the salon. Hours come from the artists' availability; contact details from
// SALON_CONTACT, each shown only once it's filled in. Privacy and terms links
// get added with those pages (Gap 25).
export async function Footer() {
    const hours = await getSalonHours()
    const { address, phone, email, instagramUrl, facebookUrl } = SALON_CONTACT
    const todayLabel = hours.closedToday
        ? "Closed today"
        : hours.today.open
          ? `Open today ${formatTimeOfDay(hours.today.open)} – ${formatTimeOfDay(hours.today.close)}`
          : "Closed today"
    const hasSocial = instagramUrl || facebookUrl

    return (
        <footer className="bg-foreground text-background print:hidden">
            <DecoRule className="mx-auto max-w-6xl px-4 pt-8 text-primary" />
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <p className="font-serif text-lg font-extrabold text-background">{SITE_NAME.toUpperCase()}</p>
                    <p className="mt-1 font-script text-lg text-primary">Amityville, N.Y.</p>
                    <ul className="mt-4 flex flex-col gap-1 text-on-dark-muted">
                        {address && (
                            <li>
                                <a href={mapUrl(address)} className="inline-flex min-h-11 items-center gap-2 text-on-dark-muted hover:text-background">
                                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                                    {address}
                                </a>
                            </li>
                        )}
                        {phone && (
                            <li>
                                <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-2 text-on-dark-muted hover:text-background">
                                    <Phone className="h-4 w-4 shrink-0" aria-hidden />
                                    {formatPhone(phone)}
                                </a>
                            </li>
                        )}
                        {email && (
                            <li>
                                <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-2 text-on-dark-muted hover:text-background">
                                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                                    {email}
                                </a>
                            </li>
                        )}
                    </ul>
                </div>

                <div>
                    <p className="flex items-center gap-2 font-semibold text-background">
                        <Clock className="h-4 w-4 text-primary" aria-hidden />
                        {todayLabel}
                    </p>
                    <dl className="mt-3 grid max-w-56 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-on-dark-muted">
                        {hours.week.map((day) => (
                            <div key={day.dayOfWeek} className="contents">
                                <dt className={day.dayOfWeek === hours.today.dayOfWeek ? "font-semibold text-background" : ""}>
                                    {DAY_NAMES[day.dayOfWeek]}
                                </dt>
                                <dd className={day.dayOfWeek === hours.today.dayOfWeek ? "font-semibold text-background" : ""}>
                                    {day.open ? `${formatTimeOfDay(day.open)} – ${formatTimeOfDay(day.close)}` : "Closed"}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div>
                    <nav aria-label="Footer" className="flex flex-col text-on-dark-muted">
                        {[
                            ["/services", "Services & Pricing"],
                            ["/artists", "Our Artists"],
                            ["/about", "About"],
                            ["/book", "Book Now"],
                        ].map(([href, label]) => (
                            <Link key={href} href={href} className="flex min-h-11 items-center text-on-dark-muted hover:text-background">
                                {label}
                            </Link>
                        ))}
                    </nav>
                    {/* Labelled pills rather than logo icons: this lucide
                        version ships no brand marks. */}
                    {hasSocial && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {[
                                [instagramUrl, "Instagram"],
                                [facebookUrl, "Facebook"],
                            ].map(([href, label]) =>
                                href ? (
                                    <a
                                        key={label}
                                        href={href}
                                        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-on-dark-subtle px-4 text-on-dark-muted hover:border-primary hover:text-primary"
                                    >
                                        {label}
                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    </a>
                                ) : null
                            )}
                        </div>
                    )}
                </div>
            </div>
            <p className="mx-auto max-w-6xl border-t border-on-dark-subtle/40 px-4 py-5 text-sm text-on-dark-subtle">
                &copy; {new Date().getFullYear()} {SITE_NAME} All rights reserved.
            </p>
        </footer>
    )
}
