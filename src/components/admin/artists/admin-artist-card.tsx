import { useState } from "react"
import type { Artist, PortfolioImage } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArtistForm, type ArtistFormValues } from "./artist-form"
import { PortfolioManager } from "./portfolio-manager"

export type ArtistWithPortfolio = Artist & { portfolio: PortfolioImage[] }

export function AdminArtistCard({
    artist,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onToggleActive,
    onPortfolioChange,
}: {
    artist: ArtistWithPortfolio
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: ArtistFormValues) => void
    onToggleActive: () => void
    onPortfolioChange: (images: PortfolioImage[]) => void
}) {
    const [portfolioOpen, setPortfolioOpen] = useState(false)

    if (isEditing) {
        return (
            <ArtistForm
                submitLabel="Save Changes"
                initial={{
                    name: artist.name,
                    bio: artist.bio ?? "",
                    photoUrl: artist.photoUrl ?? "",
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="rounded-sm border border-border bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-foreground">{artist.name}</span>
                        <Badge tone={artist.active ? "success" : "muted"}>
                            {artist.active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    {artist.bio && <p className="mt-1 text-sm text-muted-foreground">{artist.bio}</p>}
                </div>

                <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="md" onClick={() => setPortfolioOpen((open) => !open)}>
                        {portfolioOpen ? "Hide Portfolio" : `Portfolio (${artist.portfolio.length})`}
                    </Button>
                    <Button variant="secondary" size="md" onClick={onEdit}>
                        Edit
                    </Button>
                    <Button variant={artist.active ? "danger" : "secondary"} size="md" onClick={onToggleActive}>
                        {artist.active ? "Deactivate" : "Reactivate"}
                    </Button>
                </div>
            </div>

            {portfolioOpen && (
                <PortfolioManager
                    artistId={artist.id}
                    images={artist.portfolio}
                    onImagesChange={onPortfolioChange}
                />
            )}
        </div>
    )
}
