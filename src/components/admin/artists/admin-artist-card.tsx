import type { Artist } from "@/generated/prisma/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArtistForm, type ArtistFormValues } from "./artist-form"

export function AdminArtistCard({
    artist,
    isEditing,
    onEdit,
    onCancelEdit,
    onSave,
    onToggleActive,
}: {
    artist: Artist
    isEditing: boolean
    onEdit: () => void
    onCancelEdit: () => void
    onSave: (values: ArtistFormValues) => void
    onToggleActive: () => void
}) {
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
        <div className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
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
                <Button variant="secondary" size="md" onClick={onEdit}>
                    Edit
                </Button>
                <Button variant={artist.active ? "danger" : "secondary"} size="md" onClick={onToggleActive}>
                    {artist.active ? "Deactivate" : "Reactivate"}
                </Button>
            </div>
        </div>
    )
}
