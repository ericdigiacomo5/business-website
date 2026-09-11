import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

export type ProfileFormValues = {
    name: string
    email: string
    phone: string
}

export function ProfileForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
}: {
    initial: ProfileFormValues
    submitLabel: string
    onSubmit: (values: ProfileFormValues) => void
    onCancel?: () => void
}) {
    const [name, setName] = useState(initial.name)
    const [email, setEmail] = useState(initial.email)
    const [phone, setPhone] = useState(initial.phone)

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit({ name, email, phone })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <div>
                <label htmlFor="profile-name" className="block text-xs font-medium text-muted-foreground">
                    Name
                </label>
                <input
                    id="profile-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="profile-email" className="block text-xs font-medium text-muted-foreground">
                    Email
                </label>
                <input
                    id="profile-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <div>
                <label htmlFor="profile-phone" className="block text-xs font-medium text-muted-foreground">
                    Phone
                </label>
                <input
                    id="profile-phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                />
            </div>

            <div className="flex gap-2">
                <Button type="submit">{submitLabel}</Button>
                {onCancel && (
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
            </div>
        </form>
    )
}
