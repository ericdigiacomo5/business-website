import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { PhotoUploadField } from "@/components/admin/photo-upload-field"

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
                <span className="block text-xs font-medium text-muted-foreground">Photo</span>

                {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={photoUrl}
                        alt="Current"
                        className="mt-2 h-20 w-20 rounded-full border-2 border-accent object-cover"
                    />
                )}

                <div className="mt-2">
                    <PhotoUploadField
                        label={photoUrl ? "Replace Photo" : "Upload Photo"}
                        onUploaded={(url) => setPhotoUrl(url)}
                    />
                </div>

                <div className="mt-3">
                    <label htmlFor="artist-photo-url" className="block text-xs font-medium text-muted-foreground">
                        Or paste an image URL
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
                        Leave blank to show initials instead.
                    </p>
                </div>
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
