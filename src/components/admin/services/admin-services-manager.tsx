'use client'

import { useState } from "react"
import type { Service } from "@/generated/prisma/client"
import { Button } from "@/components/ui/button"
import { AdminServiceCard } from "./admin-service-card"
import { ServiceForm, type ServiceFormValues } from "./service-form"

export function AdminServicesManager({ initialServices }: { initialServices: Service[] }) {
    const [services, setServices] = useState(initialServices)
    const [isCreating, setIsCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleCreate(values: ServiceFormValues) {
        setError(null)

        try {
            const res = await fetch("/api/admin/services", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't create that service. Please try again.")
                return
            }

            const body = await res.json()
            setServices((prev) => [...prev, body.data])
            setIsCreating(false)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleSaveEdit(id: string, values: ServiceFormValues) {
        setError(null)

        try {
            const res = await fetch(`/api/admin/services/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values)
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't save changes. Please try again.")
                return
            }

            const body = await res.json()
            setServices((prev) => prev.map((s) => (s.id === id ? body.data : s)))
            setEditingId(null)
        } catch {
            setError("Network error. Please try again.")
        }
    }

    async function handleToggleActive(service: Service) {
        setError(null)

        try {
            const res = service.active
                ? await fetch(`/api/admin/services/${service.id}`, { method: "DELETE" })
                : await fetch(`/api/admin/services/${service.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: true }),
                })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error ?? "Couldn't update this service. Please try again.")
                return
            }

            const body = await res.json()
            setServices((prev) => prev.map((s) => (s.id === service.id ? body.data : s)))
        } catch {
            setError("Network error. Please try again.")
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Services</h2>
                {!isCreating && (
                    <Button size="md" onClick={() => setIsCreating(true)}>
                        New Service
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
                    <ServiceForm
                        submitLabel="Create Service"
                        onSubmit={handleCreate}
                        onCancel={() => setIsCreating(false)}
                    />
                </div>
            )}

            {services.length === 0 ? (
                <p className="mt-8 text-muted-foreground">No services yet.</p>
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {services.map((service) => (
                        <AdminServiceCard
                            key={service.id}
                            service={service}
                            isEditing={editingId === service.id}
                            onEdit={() => setEditingId(service.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onSave={(values) => handleSaveEdit(service.id, values)}
                            onToggleActive={() => handleToggleActive(service)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}