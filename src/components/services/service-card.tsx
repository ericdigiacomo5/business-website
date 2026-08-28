import Link from "next/link"
import type { Service } from "@/generated/prisma/client"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { formatDuration, formatPrice } from "@/lib/format"

export function ServiceCard({ service }: { service: Service }) {
    return (
        <Card className="flex flex-col p-5">
            <h3 className="text-base font-semibold text-surface-foreground">{service.name}</h3>
            {service.description && (
                <p className="mt-1 text-sm text-muted-foreground">{service.description}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{formatDuration(service.durationMinutes)}</span>
                <span aria-hidden>&middot;</span>
                <span className="font-medium text-surface-foreground">{formatPrice(service.priceCents)}</span>
            </div>
            <Link
                href={`/book?serviceId=${service.id}`}
                className={buttonVariants({ variant: "secondary", className: "mt-4 w-full" })}
            >
                Book This Service
            </Link>
        </Card>
    )
}
