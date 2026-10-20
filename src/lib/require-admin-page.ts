import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"

// Guard for Server Component pages under /admin — the page-side twin of
// requireAdmin() (which is for API routes). Call it as the FIRST statement
// of every admin page, awaited on its own, before any query:
//
//   await requireAdminPage("/admin/gift-cards")
//
// admin/layout.tsx checks the role too, but only for the UI it shows. Next
// renders a page in parallel with its layout, and a layout that redirects or
// leaves out {children} does not stop the page from running or from being
// serialized into the response (Next's authentication guide, "Layouts and
// auth checks"). Before this guard existed, a request with no cookie at all
// got customer names, emails, phones, credit balances and the gift-card
// register in the body of the layout's redirect. src/lib/route-guards.test.ts
// fails `npm test` if a page forgets this call.
export async function requireAdminPage(callbackPath: string) {
    const session = await auth()

    if (!session?.user) {
        redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
    }

    // The layout shows non-admins an "Access Denied" panel; the page itself
    // renders nothing for them.
    if (session.user.role !== "ADMIN") {
        notFound()
    }

    return session
}
