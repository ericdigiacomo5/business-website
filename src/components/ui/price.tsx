import { formatPrice } from "@/lib/format"
import { totalCents, type Discount } from "@/lib/discount"

// A price, or — when a discount applies — the original struck through next
// to what's actually owed.
export function Price({ priceCents, discount }: { priceCents: number; discount: Discount | null }) {
    if (!discount) return <>{formatPrice(priceCents)}</>

    return (
        <>
            <s>{formatPrice(priceCents)}</s> {formatPrice(totalCents(priceCents, discount))}
        </>
    )
}
