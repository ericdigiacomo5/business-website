import { formatPrice } from "@/lib/format"
import { formatShare, type SalesByService, type SalesTotals } from "@/lib/pay-report"

function money(cents: number | null): string {
    return cents === null ? "—" : formatPrice(cents)
}

const NUM = "px-2 py-1.5 text-right tabular-nums print:py-1"

function Figures({ row }: { row: SalesTotals }) {
    return (
        <>
            <td className={NUM}>{row.count}</td>
            <td className={NUM}>{money(row.salesCents)}</td>
            <td className={NUM}>{money(row.averageCents)}</td>
            <td className={NUM}>{formatShare(row.shareOfSales)}</td>
            <td className={NUM}>{money(row.serviceFeeCents)}</td>
        </>
    )
}

// Sales by service category, then by service: one row per service with its
// count, sales (after discounts), average, share of all sales in the table,
// and service fees charged to the artist. Each category ends in a subtotal.
export function SalesTable({ sales, caption }: { sales: SalesByService; caption: string }) {
    if (sales.categories.length === 0) {
        return <p className="text-sm text-muted-foreground">No services in this period.</p>
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-xl border-collapse text-sm print:min-w-0 print:text-xs">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="border-b-2 border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-2 text-left font-medium">
                            Service
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                            Number sold
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                            Total sales
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                            Average sale
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                            % of sales
                        </th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">
                            Service fees
                        </th>
                    </tr>
                </thead>
                {sales.categories.map((category) => (
                    <tbody key={category.category} className="break-inside-avoid">
                        <tr>
                            <th
                                scope="colgroup"
                                colSpan={6}
                                className="pt-4 pb-1 text-left font-serif text-base font-semibold text-foreground print:pt-2 print:text-sm"
                            >
                                {category.label}
                            </th>
                        </tr>
                        {category.rows.map((row) => (
                            <tr key={row.serviceId} className="border-b border-border/15">
                                <th scope="row" className="py-1.5 pr-2 pl-3 text-left font-normal print:py-1">
                                    {row.serviceName}
                                </th>
                                <Figures row={row} />
                            </tr>
                        ))}
                        <tr className="border-b border-border/40 font-semibold">
                            <th scope="row" className="py-1.5 pr-2 pl-3 text-left print:py-1">
                                {`${category.label} total`}
                            </th>
                            <Figures row={category.totals} />
                        </tr>
                    </tbody>
                ))}
                <tfoot>
                    <tr className="border-t-2 border-border font-semibold">
                        <th scope="row" className="py-2 pr-2 text-left">
                            All services
                        </th>
                        <Figures row={sales.totals} />
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
