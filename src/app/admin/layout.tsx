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
        // Nav in a left sidebar on large screens; on phones it stays a
        // horizontal strip above the page (a sidebar would take most of a
        // 375px screen). Wider than the old max-w-5xl so the content column
        // keeps about the same width next to the sidebar.
        <div className="mx-auto max-w-7xl px-4 py-8 lg:flex lg:gap-8 print:block print:max-w-none print:p-0">
            <aside className="lg:sticky lg:top-28 lg:w-52 lg:shrink-0 lg:self-start print:hidden">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin</h1>
                <AdminNav />
            </aside>
            <div className="mt-6 min-w-0 lg:mt-0 lg:flex-1 print:mt-0">{children}</div>
        </div>
    )
}