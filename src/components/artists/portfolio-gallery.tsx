import type { PortfolioImage } from "@/generated/prisma/client"
import { Camera } from "lucide-react"

export function PortfolioGallery({ images }: { images: PortfolioImage[] }) {
    if (images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border py-16 text-center text-muted-foreground">
                <Camera className="h-8 w-8" aria-hidden />
                <p className="mt-3 text-sm">No portfolio photos yet — check back soon.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => (
                // DB-sourced image, host not yet chosen — plain <img>, see artist-card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    key={image.id}
                    src={image.imageUrl}
                    alt={image.caption ?? "Portfolio photo"}
                    className="aspect-square w-full rounded-sm object-cover"
                />
            ))}
        </div>
    )
}
