import Link from "next/link"
import type { Service } from "@/generated/prisma/client"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"

export function ServiceCard({ service }: { service: Service }) {
    return (
        <Card className="relative flex flex-col p-7">
            <span className="absolute -top-3 right-5 rounded-sm bg-primary px-3.5 py-1 font-jost text-xs font-semibold tracking-wide text-white">
                {formatPrice(service.priceCents)}
            </span>
            <h3 className="mt-1 font-serif text-xl font-bold text-surface-foreground">{service.name}</h3>
            {service.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
            )}
            <div className="mt-4 text-sm text-muted-foreground">{formatDuration(service.durationMinutes)}</div>
            <Link
                href={`/book?serviceId=${service.id}`}
                className={buttonVariants({
                    variant: "secondary",
                    className: "mt-5 w-full bg-[#f0e2cf]! hover:bg-[#e6cead]!",
                })}
            >
                Book This Service
            </Link>
        </Card>
    )
}
