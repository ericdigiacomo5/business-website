import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
    return (
        <div className="mx-auto max-w-sm px-4 py-12">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create an Account</h1>
            <div className="mt-6">
                <RegisterForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    )
}
