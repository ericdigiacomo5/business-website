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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 border border-foreground bg-surface p-8">
            <div>
                <label htmlFor="profile-name" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Full Name
                </label>
                <input
                    id="profile-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>

            <div>
                <label htmlFor="profile-email" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Email
                </label>
                <input
                    id="profile-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>

            <div>
                <label htmlFor="profile-phone" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Phone
                </label>
                <input
                    id="profile-phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                />
            </div>

            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit">{submitLabel}</Button>
            </div>
        </form>
    )
}
