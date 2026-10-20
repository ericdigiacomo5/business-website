import { Control, LoadingRegion, TextLine } from "@/components/ui/page-skeletons"

// The pay report while it loads — heading and explainer, the filter card
// (dates, artist, itemized, presets), the period line with Print, then a
// sheet with its table.
export default function AdminPayReportLoading() {
    return (
        <LoadingRegion label="Loading the pay report…" className="flex flex-col gap-6">
            <div>
                <TextLine size="lg" width="w-28" />
                <TextLine width="w-full max-w-2xl" className="mt-1" />
            </div>

            <div className="rounded-lg border border-line bg-surface shadow-sm p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_1fr_auto] lg:items-end">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i}>
                            <TextLine size="xs" width="w-12" />
                            <Control width="w-full" className="mt-1" />
                        </div>
                    ))}
                    <Control width="w-full lg:w-36" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    {["w-24", "w-24", "w-24", "w-24"].map((width, i) => (
                        <Control key={i} width={width} />
                    ))}
                </div>
                <TextLine size="xs" width="w-80 max-w-full" className="mt-2" />
            </div>

            <div className="flex items-center justify-between gap-3">
                <TextLine width="w-48" />
                <Control width="w-28" />
            </div>

            <div className="rounded-lg border border-line bg-surface shadow-sm p-6">
                <TextLine size="3xl" width="w-40" />
                <TextLine size="xs" width="w-56" className="mt-1" />
                <div className="mt-6 flex flex-col">
                    {Array.from({ length: 4 }, (_, row) => (
                        <div key={row} className={`grid grid-cols-4 gap-4 py-2 sm:grid-cols-7 ${row === 0 ? "border-b-2 border-border" : "border-b border-border"}`}>
                            {Array.from({ length: 7 }, (_, col) => (
                                <TextLine key={col} size={row === 0 ? "xs" : "sm"} width={col === 0 ? "w-20" : "w-12 ml-auto"} className={col > 3 ? "hidden sm:flex" : ""} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </LoadingRegion>
    )
}
