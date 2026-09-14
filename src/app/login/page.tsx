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
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 py-12">
            <div className="w-full text-center">
                <span className="font-script text-2xl text-accent">Welcome Back,</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Sign In</h1>
            </div>
            {params.registered && (
                <p className="mt-4 w-full rounded-sm bg-success/10 px-3 py-2 text-center text-sm text-success">
                    Account created — sign in to continue.
                </p>
            )}
            <div className="mt-8 w-full">
                <LoginForm callbackUrl={callbackUrl} />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-accent hover:text-primary">
                    Create one
                </Link>
            </p>
        </div>
    )
}
