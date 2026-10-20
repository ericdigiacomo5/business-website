import { Skeleton } from "@/components/ui/skeleton"
import { BadgeSkeleton, Control, LoadingRegion, TextLine } from "@/components/ui/page-skeletons"

// My Bookings while it loads — the script "Your" over the serif title, then
// the Upcoming section with cards shaped like AppointmentCard (services,
// artist, date, length · price; badge and Reschedule / Cancel), and the
// start of Past & Cancelled. See src/app/admin/loading.tsx for why loading
// states are only added to signed-in pages.
function CardSkeleton({ upcoming }: { upcoming: boolean }) {
    return (
        <div className={upcoming ? "rounded-xl border border-line border-l-4 border-l-lacquer/40 bg-surface p-5 shadow-card" : "rounded-xl border border-line bg-surface/70 p-5"}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <TextLine size="lg" width="w-40" />
                    <TextLine width="w-24" className="mt-1" />
                    <TextLine width="w-36" className="mt-0.5" />
                    <TextLine width="w-28" className="mt-1" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <BadgeSkeleton width="w-24" />
                    {upcoming && (
                        <>
                            <Control width="w-28" />
                            <Control width="w-20" />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function SectionHeading() {
    return (
        <div className="flex h-8 items-center">
            <Skeleton className="h-5 w-36" />
        </div>
    )
}

export default function AppointmentsLoading() {
    return (
        <LoadingRegion label="Loading your bookings…" className="mx-auto max-w-3xl px-4 py-14">
            <TextLine size="lg" width="w-14" />
            <TextLine size="4xl" width="w-44" className="mt-1" />
            <div className="mt-8 flex flex-col gap-10">
                <section>
                    <SectionHeading />
                    <div className="mt-5 flex flex-col gap-4">
                        <CardSkeleton upcoming />
                        <CardSkeleton upcoming />
                    </div>
                </section>
                <section>
                    <SectionHeading />
                    <div className="mt-5 flex flex-col gap-4">
                        <CardSkeleton upcoming={false} />
                    </div>
                </section>
            </div>
        </LoadingRegion>
    )
}
