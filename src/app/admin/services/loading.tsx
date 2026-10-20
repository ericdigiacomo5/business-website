import { ListHeaderSkeleton, LoadingRegion, RowCardSkeleton } from "@/components/ui/page-skeletons"

// Services while it loads — the heading and New Service button, then rows
// shaped like AdminServiceCard (name + badge, description, details, Edit /
// Deactivate).
export default function AdminServicesLoading() {
    return (
        <LoadingRegion label="Loading services…">
            <ListHeaderSkeleton titleWidth="w-24" action="w-36" />
            <div className="mt-6 flex flex-col gap-3">
                {["w-40", "w-24", "w-32", "w-36"].map((titleWidth, i) => (
                    <RowCardSkeleton key={i} titleWidth={titleWidth} lines={i % 2 === 0 ? ["w-36", "w-32"] : ["w-32"]} buttons={["w-16", "w-32"]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
