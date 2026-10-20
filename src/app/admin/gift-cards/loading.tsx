import { Skeleton } from "@/components/ui/skeleton"
import { BadgeSkeleton, Control, LoadingRegion, TextLine } from "@/components/ui/page-skeletons"

// Gift Cards while it loads — the three totals, the Sell a Gift Card form,
// then the search box and the card list (admin-gift-cards-manager.tsx).
export default function AdminGiftCardsLoading() {
    return (
        <LoadingRegion label="Loading gift cards…" className="flex flex-col gap-8">
            <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg border border-line bg-surface shadow-sm p-4">
                        <TextLine size="xs" width="w-36" />
                        <Skeleton className="mt-1.5 h-6 w-24" />
                    </div>
                ))}
            </div>

            <section>
                <TextLine size="base" width="w-32" />
                <div className="mt-3 rounded-lg border border-line bg-surface shadow-sm p-4">
                    <TextLine width="w-80 max-w-full" />
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {[0, 1, 2].map((i) => (
                            <div key={i}>
                                <TextLine size="xs" width="w-20" />
                                <Control width="w-full" className="mt-1" />
                            </div>
                        ))}
                    </div>
                    <Control width="w-full" className="mt-3" />
                </div>
            </section>

            <section>
                <TextLine size="base" width="w-28" />
                <Control width="w-full" className="mt-3" />
                <ul className="mt-3 flex flex-col divide-y divide-border rounded-sm border border-border">
                    {[0, 1, 2].map((i) => (
                        <li key={i} className="p-3">
                            <div className="flex items-center gap-2">
                                <TextLine size="base" width="w-14" />
                                <TextLine width="w-12" />
                                <BadgeSkeleton width="w-20" />
                            </div>
                            <TextLine width="w-64 max-w-full" className="mt-1" />
                        </li>
                    ))}
                </ul>
            </section>
        </LoadingRegion>
    )
}
