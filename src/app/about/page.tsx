import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { DecoDivider } from "@/components/ui/deco"
import { SITE_NAME } from "@/lib/site"
import { getPolicySettings } from "@/lib/settings"
import { describeNoticeWindow } from "@/lib/recurring"

export default async function AboutPage() {
    // The notice window is an admin setting, so the policy stated here
    // always matches what the booking routes enforce.
    const { cancellationNoticeHours } = await getPolicySettings()

    return (
        <div className="mx-auto max-w-3xl px-4 py-14">
            <span className="font-script text-2xl text-lacquer">Our Story</span>
            <h1 className="mt-1 font-serif text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
                About {SITE_NAME}
            </h1>
            <DecoDivider className="mt-3 text-primary" />
            <div className="mt-8 space-y-4 text-lg leading-relaxed text-body">
                <p>
                    {SITE_NAME} is a nail studio built around one idea: booking an appointment should be as
                    easy as the manicure itself. Pick a service, pick an artist, pick a time that works for
                    you — no phone calls, no waiting for a callback.
                </p>
                <p>
                    {`Our artists specialize in gel manicures, nail art, and everything in between. Every booking is confirmed instantly, and you can manage it from your account — reschedule or cancel online up to ${describeNoticeWindow(cancellationNoticeHours)} before your appointment.`}
                </p>
            </div>
            <Link href="/book" className={buttonVariants({ variant: "gold", size: "lg", className: "mt-10" })}>
                Book Your Appointment
            </Link>
        </div>
    )
}
