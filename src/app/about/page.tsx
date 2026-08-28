import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { SITE_NAME } from "@/lib/site"

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">About {SITE_NAME}</h1>
            <div className="mt-6 space-y-4 text-muted-foreground">
                <p>
                    {SITE_NAME} is a nail studio built around one idea: booking an appointment should be as
                    easy as the manicure itself. Pick a service, pick an artist, pick a time that works for
                    you — no phone calls, no waiting for a callback.
                </p>
                <p>
                    Our artists specialize in gel manicures, nail art, and everything in between. Every
                    booking is confirmed instantly, and you can manage or cancel it anytime from your
                    account.
                </p>
            </div>
            <Link href="/book" className={buttonVariants({ size: "lg", className: "mt-8" })}>
                Book Your Appointment
            </Link>
        </div>
    )
}
