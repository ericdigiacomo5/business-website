import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

export type ArtistFormValues = {
    name: string
    bio: string
    photoUrl: string
}

const emptyValues: ArtistFormValues = {
    name: "",
    bio: "",
    photoUrl: "",
}

export function ArtistForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial?: ArtistFormValues
    submitLabel: string
    onSubmit: (values: ArtistFormValues) => void
    onCancel: () => void
}) {
    const [name, setName] = useState(initial?.name ?? emptyValues.name)
    const [bio, setBio] = useState(initial?.bio ?? emptyValues.bio)
    const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? emptyValues.photoUrl)

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit({ name, bio, photoUrl })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-4">
            <div>
                <label htmlFor="artist-name" className="block text-xs font-medium text-muted-foreground">
                    Name
                </label>
                <input
                    id="artist-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="artist-bio" className="block text-xs font-medium text-muted-foreground">
                    Bio
                </label>
                <textarea
                    id="artist-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="artist-photo-url" className="block text-xs font-medium text-muted-foreground">
                    Photo URL
                </label>
                <input
                    id="artist-photo-url"
                    type="url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                    Paste a link to an already-hosted image. Leave blank to show initials instead.
                </p>
            </div>

            <div className="flex gap-2">
                <Button type="submit">{submitLabel}</Button>
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}
