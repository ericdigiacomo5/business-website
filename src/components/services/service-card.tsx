import Link from "next/link"
import type { Service } from "@/generated/prisma/client"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { DecoFrame } from "@/components/ui/deco"
import { formatDuration, formatPrice } from "@/lib/format"

export function ServiceCard({ service }: { service: Service }) {
    return (
        <Card className="relative flex flex-col p-7 transition duration-200 hover:shadow-raised motion-safe:hover:-translate-y-1">
            <span className="text-primary">
                <DecoFrame className="inset-2 rounded-lg" />
            </span>
            {/* The price as a lacquer tag in Bodoni italic. */}
            <span className="absolute -top-3.5 right-5 rounded-full bg-lacquer px-4 py-1 font-serif text-base font-bold italic text-lacquer-foreground shadow-sm">
                {formatPrice(service.priceCents)}
            </span>
            <h3 className="mt-1 font-serif text-2xl font-bold text-surface-foreground">{service.name}</h3>
            {service.description && (
                <p className="mt-2 text-base leading-relaxed text-body">{service.description}</p>
            )}
            {/* mt-auto pushes duration + button to the bottom of the card, so
                they line up across a grid row even when one card has no (or a
                shorter) description. Cards stretch to the row's height as grid
                items, and the card is already flex-col. */}
            <div className="mt-auto pt-4">
                <div className="text-sm text-muted-foreground">{formatDuration(service.durationMinutes)}</div>
                <Link
                    href={`/book?serviceId=${service.id}`}
                    className={buttonVariants({ variant: "secondary", className: "mt-5 w-full" })}
                >
                    Book This Service
                </Link>
            </div>
        </Card>
    )
}
