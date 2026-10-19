import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { PhotoUploadField } from "@/components/admin/photo-upload-field"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { TEXT_LIMITS } from "@/lib/validation"
import { percentToBasisPoints } from "@/lib/pay-report"

export type ArtistFormValues = {
    name: string
    bio: string
    photoUrl: string
    // 4500 = 45%; null = not set.
    commissionBasisPoints: number | null
}

const emptyValues: ArtistFormValues = {
    name: "",
    bio: "",
    photoUrl: "",
    commissionBasisPoints: null,
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
    // Typed as a percent ("45", "42.5"), stored as basis points.
    const initialRate = initial?.commissionBasisPoints ?? emptyValues.commissionBasisPoints
    const [commission, setCommission] = useState(initialRate === null ? "" : String(initialRate / 100))
    const commissionBasisPoints = commission.trim() === "" ? null : percentToBasisPoints(commission)
    const commissionInvalid = commission.trim() !== "" && commissionBasisPoints === null

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        if (commissionInvalid) return
        onSubmit({ name, bio, photoUrl, commissionBasisPoints })
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
                    maxLength={TEXT_LIMITS.artistName}
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
                    maxLength={TEXT_LIMITS.bio}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="artist-commission" className="block text-xs font-medium text-muted-foreground">
                    Commission (%)
                </label>
                <input
                    id="artist-commission"
                    inputMode="decimal"
                    placeholder="e.g. 45"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    aria-invalid={commissionInvalid}
                    aria-describedby="artist-commission-help"
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground sm:w-40"
                />
                <p
                    id="artist-commission-help"
                    className={"mt-1 text-xs " + (commissionInvalid ? "text-danger" : "text-muted-foreground")}
                >
                    {commissionInvalid
                        ? "Enter a percentage from 0 to 100, up to two decimals."
                        : "Share of service sales (after discounts) paid to the artist. Only visits checked out from now on use a new rate. Leave blank if not agreed yet."}
                </p>
            </div>

            <div>
                <span className="block text-xs font-medium text-muted-foreground">Photo</span>

                {photoUrl && (
                    <CloudinaryImage
                        src={photoUrl}
                        alt="Current photo"
                        sizes="80px"
                        className="mt-2 h-20 w-20 rounded-full border-2 border-accent"
                        fallback={
                            <p className="mt-2 text-xs text-muted-foreground">
                                The current photo isn&apos;t an uploaded image and can&apos;t be shown — upload a
                                replacement.
                            </p>
                        }
                    />
                )}

                {/* Uploads only (no pasted URLs): every photo is stored on
                    the salon's Cloudinary account, which is what lets the
                    CSP and next/image allow exactly one image host. */}
                <div className="mt-2 flex flex-wrap gap-2">
                    <PhotoUploadField
                        label={photoUrl ? "Replace Photo" : "Upload Photo"}
                        onUploaded={(url) => setPhotoUrl(url)}
                    />
                    {photoUrl && (
                        <Button type="button" variant="ghost" onClick={() => setPhotoUrl("")}>
                            Remove Photo
                        </Button>
                    )}
                </div>
                {!photoUrl && (
                    <p className="mt-1 text-xs text-muted-foreground">No photo — initials are shown instead.</p>
                )}
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
