import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"

export default function RegisterPage() {
    return (
        <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 py-12">
            <div className="w-full text-center">
                <span className="font-script text-2xl text-accent">Join the</span>
                <h1 className="mt-1 font-serif text-4xl font-extrabold text-foreground">Nail Image Family</h1>
            </div>
            <div className="mt-8 w-full">
                <RegisterForm />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-accent hover:text-primary">
                    Sign in
                </Link>
            </p>
        </div>
    )
}
