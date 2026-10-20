import Link from "next/link"
import { VerifyEmailForm } from "@/components/auth/verify-email-form"

// Opened from the link in a signup or email-change confirmation email
// (src/lib/email-verification.ts).
export default async function VerifyEmailPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>
}) {
    const { token } = await searchParams

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 py-12">
            <div className="w-full text-center">
                <span className="font-script text-2xl text-lacquer">Confirm Your</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Email</h1>
            </div>
            <div className="mt-8 w-full">
                {token ? (
                    <VerifyEmailForm token={token} />
                ) : (
                    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-raised text-center">
                        <p className="text-sm text-danger">This link is invalid or has expired.</p>
                        <Link href="/account" className="text-sm font-semibold text-accent hover:text-primary-strong">
                            Go to My Account to get a new link
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
