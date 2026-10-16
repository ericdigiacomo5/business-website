'use client' // Error boundaries must be Client Components

import { useEffect } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"

// Catches unexpected errors thrown while rendering any page below the root
// layout, so a failed database read shows this instead of a blank screen.
// The header and footer stay visible (they live in the layout). Errors in
// the root layout itself would need a global-error.tsx, which isn't added.
//
// retry() (stable since Next 16.3) re-fetches and re-renders the segment —
// the right recovery for a transient failure like a dropped DB connection.
export default function Error({
    error,
    retry,
}: {
    error: Error & { digest?: string }
    retry: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="mx-auto max-w-3xl px-4 py-14">
            <span className="font-script text-2xl text-accent">Something went wrong</span>
            <h1 className="mt-1 font-serif text-4xl font-extrabold leading-tight text-foreground">
                This page didn&apos;t load
            </h1>
            <p className="mt-6 text-muted-foreground">
                Please try again. If it keeps happening, contact the salon directly.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={() => retry()}>
                    Try Again
                </Button>
                <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    Go Home
                </Link>
            </div>
        </div>
    )
}
