import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

export type ServiceFormValues = {
    name: string
    description: string
    durationMinutes: number
    priceCents: number
}

const emptyValues: ServiceFormValues = {
    name: "",
    description: "",
    durationMinutes: 45,
    priceCents: 0,
}

export function ServiceForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial?: ServiceFormValues
    submitLabel: string
    onSubmit: (values: ServiceFormValues) => void
    onCancel: () => void
}) {
    const [name, setName] = useState(initial?.name ?? emptyValues.name)
    const [description, setDescription] = useState(initial?.description ?? emptyValues.description)
    const [durationMinutes, setDurationMinutes] = useState(
        String(initial?.durationMinutes ?? emptyValues.durationMinutes)
    )
    const [priceDollars, setPriceDollars] = useState(
        String((initial?.priceCents ?? emptyValues.priceCents) / 100)
    )

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit({
            name,
            description,
            durationMinutes: Number(durationMinutes),
            priceCents: Math.round(Number(priceDollars) * 100),
        })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-4">
            <div>
                <label htmlFor="service-name" className="block text-xs font-medium text-muted-foreground">
                    Name
                </label>
                <input
                    id="service-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="service-description" className="block text-xs font-medium text-muted-foreground">
                    Description
                </label>
                <textarea
                    id="service-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
            </div>

            <div className="flex gap-4">
                <div className="flex-1">
                    <label htmlFor="service-duration" className="block text-xs font-medium text-muted-foreground">
                        Duration (minutes)
                    </label>
                    <input
                        id="service-duration"
                        type="number"
                        min={15}
                        step={15}
                        required
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                    />
                </div>

                <div className="flex-1">
                    <label htmlFor="service-price" className="block text-xs font-medium text-muted-foreground">
                        Price (USD)
                    </label>
                    <input
                        id="service-price"
                        type="number"
                        min={0}
                        step={0.01}
                        required
                        value={priceDollars}
                        onChange={(e) => setPriceDollars(e.target.value)}
                        className="mt-1 h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"
                    />
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