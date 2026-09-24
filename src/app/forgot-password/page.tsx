import Link from "next/link"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export default function ForgotPasswordPage() {
    return (
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 py-12">
            <div className="w-full text-center">
                <span className="font-script text-2xl text-accent">Forgot Your</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Password?</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a link to reset it.
                </p>
            </div>
            <div className="mt-8 w-full">
                <ForgotPasswordForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link href="/login" className="font-semibold text-accent hover:text-primary">
                    Sign in
                </Link>
            </p>
        </div>
    )
}
