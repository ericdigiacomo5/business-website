import Link from "next/link"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string }>
}) {
    const { token } = await searchParams

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 py-12">
            <div className="w-full text-center">
                <span className="font-script text-2xl text-accent">Choose a New</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Password</h1>
            </div>
            <div className="mt-8 w-full">
                {token ? (
                    <ResetPasswordForm token={token} />
                ) : (
                    // No token in the URL at all — this page was reached
                    // directly, not via a real emailed link. The API's own
                    // validation still catches a garbage/expired/used token
                    // once submitted; this is just the zero-token case, which
                    // has nothing to submit.
                    <div className="flex flex-col gap-4 border border-foreground bg-surface p-8 text-center">
                        <p className="text-sm text-danger">This link is invalid or has expired.</p>
                        <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:text-primary">
                            Request a new link
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
