'use client'

import { useRef, useState } from "react"
import Link from "next/link"
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { buttonVariants } from "@/components/ui/button"
import { isCloudinaryUrl } from "@/lib/validation"

type GalleryImage = { id: string; imageUrl: string; caption: string | null }

// How far a horizontal swipe must travel to change photo.
const SWIPE_PX = 50

// The artist's portfolio: a grid of thumbnails, each opening a full-size
// viewer (FEATURE_GAPS.md U11). A native <dialog> opened with showModal(),
// so focus is trapped inside it, Escape closes it, the page behind is inert,
// and focus returns to the thumbnail afterwards — all from the browser.
export function PortfolioGallery({
    images,
    artistId,
    artistName,
}: {
    images: GalleryImage[]
    artistId: string
    artistName: string
}) {
    // Only uploaded (Cloudinary) images can be shown — see CloudinaryImage.
    const shown = images.filter((image) => isCloudinaryUrl(image.imageUrl))
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [index, setIndex] = useState(0)
    const swipeStart = useRef<number | null>(null)

    if (shown.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface py-16 text-center text-muted-foreground">
                <Camera className="h-8 w-8" aria-hidden />
                <p className="mt-3 text-sm">No portfolio photos yet — check back soon.</p>
            </div>
        )
    }

    const current = shown[index]
    const step = (delta: number) => setIndex((i) => (i + delta + shown.length) % shown.length)

    function open(i: number) {
        setIndex(i)
        dialogRef.current?.showModal()
    }

    return (
        <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {shown.map((image, i) => (
                    <li key={image.id}>
                        <button
                            type="button"
                            onClick={() => open(i)}
                            aria-label={`View ${image.caption ?? `photo ${i + 1}`} larger`}
                            className="group block w-full cursor-zoom-in overflow-hidden rounded-xl shadow-card transition-shadow hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                            <CloudinaryImage
                                src={image.imageUrl}
                                alt={image.caption ?? "Portfolio photo"}
                                sizes="(min-width: 768px) 256px, (min-width: 640px) 33vw, 50vw"
                                className="aspect-square w-full transition duration-300 motion-safe:group-hover:scale-105"
                            />
                        </button>
                    </li>
                ))}
            </ul>

            <dialog
                ref={dialogRef}
                aria-label={`${artistName}'s portfolio`}
                // Clicking the dimmed backdrop (the dialog element itself,
                // outside its content box) closes it.
                onClick={(e) => {
                    if (e.target === dialogRef.current) dialogRef.current?.close()
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowRight") step(1)
                    if (e.key === "ArrowLeft") step(-1)
                }}
                className="m-auto max-h-[95vh] w-[min(100vw-2rem,48rem)] overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground backdrop:bg-foreground/80"
            >
                <div
                    className="relative"
                    onPointerDown={(e) => {
                        swipeStart.current = e.clientX
                    }}
                    onPointerUp={(e) => {
                        if (swipeStart.current === null) return
                        const travelled = e.clientX - swipeStart.current
                        swipeStart.current = null
                        if (Math.abs(travelled) >= SWIPE_PX) step(travelled < 0 ? 1 : -1)
                    }}
                >
                    <CloudinaryImage
                        key={current.id}
                        src={current.imageUrl}
                        alt={current.caption ?? `Portfolio photo ${index + 1} of ${shown.length}`}
                        sizes="(min-width: 768px) 768px, 100vw"
                        className="aspect-square max-h-[70vh] w-full bg-muted"
                    />
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        aria-label="Close"
                        className="absolute top-2 right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    {shown.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={() => step(-1)}
                                aria-label="Previous photo"
                                className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button
                                type="button"
                                onClick={() => step(1)}
                                aria-label="Next photo"
                                className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </>
                    )}
                </div>
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-body" aria-live="polite">
                        {current.caption ? `${current.caption} · ` : ""}
                        <span className="text-muted-foreground">{`${index + 1} of ${shown.length}`}</span>
                    </p>
                    <Link href={`/book?artistId=${artistId}`} className={buttonVariants({ className: "w-full sm:w-auto" })}>
                        {`Book with ${artistName.split(" ")[0]}`}
                    </Link>
                </div>
            </dialog>
        </>
    )
}
