import { Control, LoadingRegion, RowCardSkeleton, TextLine } from "@/components/ui/page-skeletons"

// Customers while it loads — the heading, the search box, then rows shaped
// like AdminUserRow (name + role badge, email, phone).
export default function AdminUsersLoading() {
    return (
        <LoadingRegion label="Loading customers…">
            <TextLine size="lg" width="w-16" />
            <Control width="w-full" className="mt-4" />
            <div className="mt-6 flex flex-col gap-3">
                {["w-28", "w-20", "w-32", "w-24"].map((titleWidth, i) => (
                    <RowCardSkeleton key={i} titleWidth={titleWidth} lines={["w-56", "w-24"]} buttons={[]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
