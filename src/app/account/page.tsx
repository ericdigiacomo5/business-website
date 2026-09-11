import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MyProfileForm } from "@/components/account/my-profile-form"

export default async function AccountPage() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login?callbackUrl=/account")
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, phone: true },
    })

    if (!user) {
        redirect("/login?callbackUrl=/account")
    }

    return (
        <div className="mx-auto max-w-sm px-4 py-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Profile</h1>
            <MyProfileForm initial={{ name: user.name ?? "", email: user.email, phone: user.phone }} />
        </div>
    )
}
