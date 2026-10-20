import { FilterRowSkeleton, ListHeaderSkeleton, LoadingRegion, RowCardSkeleton } from "@/components/ui/page-skeletons"

// Availability while it loads — the artist picker, the heading and New
// Window button, then weekday rows (day, hours; Edit / Delete).
export default function AdminAvailabilityLoading() {
    return (
        <LoadingRegion label="Loading availability…">
            <FilterRowSkeleton fields={["w-28"]} button="w-20" />
            <ListHeaderSkeleton titleWidth="w-28" action="w-36" className="mt-6" />
            <div className="mt-6 flex flex-col gap-3">
                {["w-20", "w-24", "w-20"].map((titleWidth, i) => (
                    <RowCardSkeleton key={i} titleWidth={titleWidth} badge={false} lines={["w-24"]} buttons={["w-16", "w-20"]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
