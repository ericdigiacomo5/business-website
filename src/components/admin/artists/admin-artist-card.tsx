import { useState } from "react"
import type { Artist, PortfolioImage } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { formatRate } from "@/lib/pay-report"
import { ArtistForm, type ArtistFormValues, type PickableService } from "./artist-form"
import { PortfolioManager } from "./portfolio-manager"
import { offeredServiceIdsOf } from "@/lib/artist-services"

// payTerms: the commission rate (admin-only data, see ArtistPayTerms);
// null = not set yet. services: what they perform; none = everything.
export type ArtistWithPortfolio = Artist & {
    portfolio: PortfolioImage[]
    payTerms: { commissionBasisPoints: number } | null
    services: { serviceId: string }[]
}

export function AdminArtistCard({
    artist,
    services,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onToggleActive,
    onPortfolioChange,
}: {
    artist: ArtistWithPortfolio
    services: PickableService[]
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: ArtistFormValues) => void
    onToggleActive: () => void
    onPortfolioChange: (images: PortfolioImage[]) => void
}) {
    const [portfolioOpen, setPortfolioOpen] = useState(false)
    const offered = offeredServiceIdsOf(artist)

    if (isEditing) {
        return (
            <ArtistForm
                services={services}
                submitLabel="Save Changes"
                initial={{
                    name: artist.name,
                    bio: artist.bio ?? "",
                    photoUrl: artist.photoUrl ?? "",
                    commissionBasisPoints: artist.payTerms?.commissionBasisPoints ?? null,
                    serviceIds: offered,
                }}
                onSubmit={onSave}
                onCancel={onCancelEdit}
            />
        )
    }

    return (
        <div className="rounded-lg border border-line bg-surface shadow-sm p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-surface-foreground">{artist.name}</span>
                        <Badge tone={artist.active ? "success" : "muted"}>
                            {artist.active ? "Active" : "Inactive"}
                        </Badge>
                    </div>
                    {artist.bio && <p className="mt-1 text-sm text-muted-foreground">{artist.bio}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">
                        {artist.payTerms
                            ? `Commission ${formatRate(artist.payTerms.commissionBasisPoints)}`
                            : "Commission not set"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {offered.length === 0
                            ? "Does every service"
                            : `Does: ${services
                                  .filter((service) => offered.includes(service.id))
                                  .map((service) => service.name)
                                  .join(", ")}`}
                    </p>
                </div>

                <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="md" onClick={() => setPortfolioOpen((open) => !open)}>
                        {portfolioOpen ? "Hide Portfolio" : `Portfolio (${artist.portfolio.length})`}
                    </Button>
                    <Button variant="secondary" size="md" onClick={onEdit}>
                        Edit
                    </Button>
                    {artist.active ? (
                        <ConfirmAction
                            label="Deactivate"
                            prompt={`Stop taking bookings for ${artist.name}?`}
                            confirmLabel="Yes, Deactivate"
                            onConfirm={onToggleActive}
                        />
                    ) : (
                        <Button variant="secondary" size="md" onClick={onToggleActive}>
                            Reactivate
                        </Button>
                    )}
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
