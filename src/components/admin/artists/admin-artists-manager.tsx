'use client'

import { useState } from "react"
import type { PortfolioImage } from "@/generated/prisma/client"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/components/ui/toast"
import { AdminArtistCard, type ArtistWithPortfolio } from "./admin-artist-card"
import { ArtistForm, type ArtistFormValues, type PickableService } from "./artist-form"

export function AdminArtistsManager({
    initialArtists,
    services,
}: {
    initialArtists: ArtistWithPortfolio[]
    services: PickableService[]
}) {
    const [artists, setArtists] = useState(initialArtists)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const toast = useToast()

    async function handleCreate(values: ArtistFormValues) {
        setError(null)

        try {
            const res = await fetch("/api/admin/artists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't create that artist. Please try again.")
                return
            }

            const body = await res.json()
            // POST /api/admin/artists returns a plain Artist — a brand-new
            // artist has no portfolio images yet regardless, so this is
            // always correct, not just a stand-in.
            const created: ArtistWithPortfolio = { ...body.data, portfolio: [] }
            setArtists((prev) => [...prev, created])
            setIsCreating(false)
            toast(`${created.name} added.`)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleSaveEdit(id: string, values: ArtistFormValues) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/artists/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            const body = await res.json()
            // PATCH /api/admin/artists/[id] also returns a plain Artist —
            // preserve the portfolio this artist already had in state,
            // since the response itself says nothing about it (a PATCH here
            // only ever touches name/bio/photoUrl/active, never portfolio).
            setArtists((prev) =>
                prev.map((a) => (a.id === id ? { ...body.data, portfolio: a.portfolio } : a))
            )
            setEditingId(null)
            toast(`${body.data.name} saved.`)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleToggleActive(artist: ArtistWithPortfolio) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/artists/${artist.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !artist.active }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update this artist. Please try again.")
                return
            }

            const body = await res.json()
            setArtists((prev) =>
                prev.map((a) => (a.id === artist.id ? { ...body.data, portfolio: a.portfolio } : a))
            )
            toast(body.data.active ? `${body.data.name} is bookable again.` : `${body.data.name} deactivated — no longer bookable.`)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    function handlePortfolioChange(artistId: string, images: PortfolioImage[]) {
        setArtists((prev) => prev.map((a) => (a.id === artistId ? { ...a, portfolio: images } : a)))
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Artists</h2>
                {!isCreating && (
                    <Button size="md" onClick={() => setIsCreating(true)}>
                        New Artist
                    </Button>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                </p>
            )}

            {isCreating && (
                <div className="mt-4">
                    <ArtistForm
                        services={services}
                        submitLabel="Create Artist"
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}

            {artists.length === 0 ? (
                <EmptyState icon={Users} title="No artists yet" className="mt-8">
                    Add the first one with New Artist, then set their weekly hours under Availability.
                </EmptyState>
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {artists.map((artist) => (
                        <AdminArtistCard
                            key={artist.id}
                            artist={artist}
                            services={services}
                            isEditing={editingId === artist.id}
                            onEdit={() => setEditingId(artist.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={(values) => handleSaveEdit(artist.id, values)}
                            onToggleActive={() => handleToggleActive(artist)}
                            onPortfolioChange={(images) => handlePortfolioChange(artist.id, images)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
