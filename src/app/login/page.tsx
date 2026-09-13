import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { safeCallbackUrl } from "@/lib/validation"

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ callbackUrl?: string; registered?: string }>
}) {
    const params = await searchParams
    // Validated server-side so the untrusted query value never reaches the
    // client as a trusted prop.
    const callbackUrl = safeCallbackUrl(params.callbackUrl)

    return (
        <div className="mx-auto max-w-sm px-4 py-12">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign In</h1>
            {params.registered && (
                <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                    Account created — sign in to continue.
                </p>
            )}
            <div className="mt-6">
                <LoginForm callbackUrl={callbackUrl} />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">
                    Create one
                </Link>
            </p>
        </div>
    )
}
