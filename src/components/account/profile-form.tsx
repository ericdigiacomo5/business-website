import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"

export type ProfileFormValues = {
    name: string
    email: string
    phone: string
    // Sent only when the email changed and askPasswordOnEmailChange is set.
    currentPassword?: string
}

export function ProfileForm({
    initial,
    submitLabel,
    onSubmit,
    onCancel,
    askPasswordOnEmailChange = false,
}: {
    initial: ProfileFormValues
    submitLabel: string
    onSubmit: (values: ProfileFormValues) => void
    onCancel?: () => void
    // The customer's own profile: changing the email needs the current
    // password (PATCH /api/users/me). Admins editing a customer don't get
    // this field.
    askPasswordOnEmailChange?: boolean
}) {
    const [name, setName] = useState(initial.name)
    const [email, setEmail] = useState(initial.email)
    const [phone, setPhone] = useState(initial.phone)
    const [currentPassword, setCurrentPassword] = useState("")
    const emailChanged = email.trim().toLowerCase() !== initial.email.trim().toLowerCase()
    const showPassword = askPasswordOnEmailChange && emailChanged

    function handleSubmit(e: FormEvent) {
        e.preventDefault()
        onSubmit(showPassword ? { name, email, phone, currentPassword } : { name, email, phone })
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-8 shadow-raised">
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

            {showPassword && (
                <div>
                    <label htmlFor="profile-current-password" className="block font-jost text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current Password
                    </label>
                    <input
                        id="profile-current-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1.5 h-12 w-full rounded-sm border border-foreground bg-background px-4 text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        Needed to change your email. We&apos;ll send a link to the new address — the change takes
                        effect once you click it.
                    </p>
                </div>
            )}

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
