import { Skeleton } from "@/components/ui/skeleton"
import { Control, LoadingRegion, RowCardSkeleton, TextLine } from "@/components/ui/page-skeletons"

// A customer's page while it loads — back link, the profile card, the
// Summary grid (customer-summary-panel.tsx), Store Credit, then the
// history list.
export default function AdminUserDetailLoading() {
    return (
        <LoadingRegion label="Loading customer…">
            <TextLine width="w-32" />
            <div className="mt-4">
                <RowCardSkeleton titleWidth="w-28" lines={["w-44", "w-24"]} buttons={["w-16", "w-44"]} />
            </div>

            <TextLine size="base" width="w-20" className="mt-6" />
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="bg-surface p-3">
                        <TextLine size="xs" width="w-14" />
                        <TextLine size="base" width={i % 3 === 0 ? "w-24" : "w-16"} className="mt-0.5" />
                    </div>
                ))}
            </div>

            <TextLine size="base" width="w-28" className="mt-8" />
            <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-surface shadow-sm p-4">
                <div>
                    <TextLine size="xs" width="w-16" />
                    <Skeleton className="mt-1 h-7 w-24" />
                </div>
                <Control width="w-20" />
            </div>

            <TextLine size="base" width="w-40" className="mt-8" />
            <div className="mt-3 flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                    <RowCardSkeleton key={i} titleWidth="w-28" lines={["w-24", "w-40"]} buttons={[]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
