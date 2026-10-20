import { FilterRowSkeleton, ListHeaderSkeleton, LoadingRegion, RowCardSkeleton } from "@/components/ui/page-skeletons"

// Time Off while it loads — the artist (or salon-wide) picker, the heading
// and New Time Off button, then rows shaped like AdminTimeOffRow (date,
// hours; Edit / Delete).
export default function AdminTimeOffLoading() {
    return (
        <LoadingRegion label="Loading time off…">
            <FilterRowSkeleton fields={["w-36"]} button="w-20" />
            <ListHeaderSkeleton titleWidth="w-20" action="w-36" className="mt-6" />
            <div className="mt-6 flex flex-col gap-3">
                {["w-36", "w-44"].map((titleWidth, i) => (
                    <RowCardSkeleton key={i} titleWidth={titleWidth} badge={false} lines={["w-24"]} buttons={["w-16", "w-20"]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
