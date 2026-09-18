'use client'

import { useState } from "react"
import { X } from "lucide-react"
import type { PortfolioImage } from "@/generated/prisma/client"
import { PhotoUploadField } from "@/components/admin/photo-upload-field"

// Unlike ArtistForm's single photoUrl field, this manages a *list* — each
// photo is its own row in the database, added and removed independently,
// rather than one value swapped out on save. So instead of local component
// state feeding a form's onSubmit, every action here calls its API route
// immediately (same shape as AdminArtistsManager's handleToggleActive: fire
// the request, then reconcile state from the real response).
//
// `images` is owned by the caller, not this component — this component used
// to hold its own copy in useState, but that copy lived only as long as this
// component stayed mounted. AdminArtistCard unmounts this component whenever
// the portfolio section is collapsed (see its `{portfolioOpen && ...}`), so
// every upload/delete was getting thrown away the moment the admin closed
// the section: the parent's copy of artist.portfolio never heard about the
// change, so re-expanding just re-showed the same stale list it started
// with. Lifting the list up to AdminArtistsManager (the actual long-lived
// owner of all artist state) fixes that the same way ArtistForm reports
// back via onSubmit instead of owning "the artist" itself.
export function PortfolioManager({
    artistId,
    images,
    onImagesChange,
}: {
    artistId: string
    images: PortfolioImage[]
    onImagesChange: (images: PortfolioImage[]) => void
}) {
    const [error, setError] = useState<string | null>(null)

    async function handleUploaded(imageUrl: string) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/artists/${artistId}/portfolio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save that photo. Please try again.")
                return
            }

            const body = await res.json()
            onImagesChange([...images, body.data])
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleDelete(imageId: string) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/artists/${artistId}/portfolio/${imageId}`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't delete that photo. Please try again.")
                return
            }

            onImagesChange(images.filter((img) => img.id !== imageId))
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div className="mt-3 border-t border-border pt-3">
            {error && (
                <p role="alert" className="mb-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((image) => (
                        <div key={image.id} className="group relative">
                            {/* DB-sourced image, same host-not-chosen-yet
                                reasoning as the public PortfolioGallery —
                                now Cloudinary-hosted in practice, but the
                                field itself is still just a plain string. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={image.imageUrl}
                                alt={image.caption ?? "Portfolio photo"}
                                className="aspect-square w-full rounded-sm object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => handleDelete(image.id)}
                                aria-label="Delete photo"
                                className="absolute right-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-danger"
                            >
                                <X className="h-4 w-4" aria-hidden />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3">
                <PhotoUploadField label="Add Portfolio Photo" onUploaded={handleUploaded} />
            </div>
        </div>
    )
}
