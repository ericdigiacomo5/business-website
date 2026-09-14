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

    const initials = (user.name || user.email)
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()

    return (
        <div className="mx-auto max-w-2xl px-4 py-14">
            <div className="mb-10 flex flex-wrap items-center gap-5">
                <div className="flex h-20 w-20 flex-none items-center justify-center rounded-full border-2 border-accent bg-muted text-xl font-semibold text-accent">
                    {initials}
                </div>
                <div>
                    <span className="font-script text-xl text-accent">Hello,</span>
                    <h1 className="mt-0.5 font-serif text-3xl font-extrabold text-foreground">
                        {user.name || user.email}
                    </h1>
                </div>
            </div>
            <MyProfileForm initial={{ name: user.name ?? "", email: user.email, phone: user.phone }} />
        </div>
    )
}
