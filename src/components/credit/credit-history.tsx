import { formatPrice } from "@/lib/format"
import { describeCreditEntry, type CreditEntryRow } from "@/lib/credit-shared"

// A store-credit ledger, newest first. Shared by My Account and the admin
// customer page; the admin's rows also say who made each change.
export function CreditHistory({ entries }: { entries: CreditEntryRow[] }) {
    if (entries.length === 0) {
        return <p className="mt-3 text-sm text-muted-foreground">No store credit activity yet.</p>
    }

    return (
        <ul className="mt-3 flex flex-col divide-y divide-border rounded-sm border border-border">
            {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4 p-3 text-sm">
                    <div>
                        <p className="font-medium text-foreground">{describeCreditEntry(entry)}</p>
                        <p className="mt-0.5 text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                            {entry.createdBy && ` · by ${entry.createdBy.name ?? entry.createdBy.email}`}
                        </p>
                        {entry.note && <p className="mt-0.5 text-muted-foreground">{entry.note}</p>}
                    </div>
                    <span
                        className={
                            "shrink-0 font-medium " + (entry.amountCents > 0 ? "text-success" : "text-foreground")
                        }
                    >
                        {entry.amountCents > 0 ? "+" : "−"}
                        {formatPrice(Math.abs(entry.amountCents))}
                    </span>
                </li>
            ))}
        </ul>
    )
}
