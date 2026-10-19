'use client'

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

// The browser's own print dialog — "Save as PDF" there covers PDFs, so the
// report needs no PDF library (see PLAN_ARTIST_PAY_REPORT.md, "Printing").
export function PrintButton({ label }: { label: string }) {
    return (
        <Button type="button" size="md" onClick={() => window.print()} className="print:hidden">
            <Printer className="h-4 w-4" aria-hidden />
            {label}
        </Button>
    )
}
