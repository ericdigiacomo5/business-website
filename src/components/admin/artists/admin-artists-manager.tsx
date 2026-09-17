'use client'

import { useState } from "react"
import type { Artist } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { AdminArtistCard } from "./admin-artist-card"
import { ArtistForm, type ArtistFormValues } from "./artist-form"

export function AdminArtistsManager({ initialArtists }: { initialArtists: Artist[] }) {
    const [artists, setArtists] = useState(initialArtists)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

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
            setArtists((prev) => [...prev, body.data])
            setIsCreating(false)
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
            setArtists((prev) => prev.map((a) => (a.id === id ? body.data : a)))
            setEditingId(null)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleToggleActive(artist: Artist) {
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
            setArtists((prev) => prev.map((a) => (a.id === artist.id ? body.data : a)))
        } catch {
            setError("Network error. Please try again.")
        }
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
                        submitLabel="Create Artist"
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}

            {artists.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No artists yet.</p>
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {artists.map((artist) => (
                        <AdminArtistCard
                            key={artist.id}
                            artist={artist}
                            isEditing={editingId === artist.id}
                            onEdit={() => setEditingId(artist.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={(values) => handleSaveEdit(artist.id, values)}
                            onToggleActive={() => handleToggleActive(artist)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
