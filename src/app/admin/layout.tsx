import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AdminNav } from "@/components/admin/admin-nav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login?callbackUrl=/admin")
    }

    if (session.user.role !== "ADMIN") {
        return (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
                <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
                <p className="mt-2 text-muted-foreground">
                    This area is for salon staff only. If you think this is a mistake, contact the salon.
                </p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin</h1>
            <AdminNav />
            <div className="mt-6">{children}</div>
        </div>
    )
}