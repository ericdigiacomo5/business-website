import type { PortfolioImage } from "@/generated/prisma/client"
import { Camera } from "lucide-react"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { isCloudinaryUrl } from "@/lib/validation"

export function PortfolioGallery({ images }: { images: PortfolioImage[] }) {
    // Only uploaded (Cloudinary) images can be shown — see CloudinaryImage.
    const shown = images.filter((image) => isCloudinaryUrl(image.imageUrl))

    if (shown.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border py-16 text-center text-muted-foreground">
                <Camera className="h-8 w-8" aria-hidden />
                <p className="mt-3 text-sm">No portfolio photos yet — check back soon.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shown.map((image) => (
                <CloudinaryImage
                    key={image.id}
                    src={image.imageUrl}
                    alt={image.caption ?? "Portfolio photo"}
                    sizes="(min-width: 768px) 256px, (min-width: 640px) 33vw, 50vw"
                    className="aspect-square w-full rounded-sm"
                />
            ))}
        </div>
    )
}
