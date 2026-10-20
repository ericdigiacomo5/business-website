import { ListHeaderSkeleton, LoadingRegion, RowCardSkeleton } from "@/components/ui/page-skeletons"

// Artists while it loads — rows shaped like AdminArtistCard (name + badge,
// bio, commission, services; Portfolio / Edit / Deactivate).
export default function AdminArtistsLoading() {
    return (
        <LoadingRegion label="Loading artists…">
            <ListHeaderSkeleton titleWidth="w-20" action="w-32" />
            <div className="mt-6 flex flex-col gap-3">
                {["w-28", "w-24", "w-36"].map((titleWidth, i) => (
                    <RowCardSkeleton key={i} titleWidth={titleWidth} lines={["w-36", "w-28", "w-32"]} buttons={["w-36", "w-16", "w-32"]} />
                ))}
            </div>
        </LoadingRegion>
    )
}
