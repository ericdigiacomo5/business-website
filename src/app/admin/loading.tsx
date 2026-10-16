import { Spinner } from "@/components/ui/spinner"

// Shown inside the admin layout (nav stays visible) while an admin page's
// database reads run — the schedule's week view alone makes ~16 queries.
// Deliberately only here and on /appointments, not at the root: a loading
// state makes the response stream, which fixes its HTTP status at 200, so a
// root one would turn public 404s (e.g. an unknown /artists/[id]) into
// "soft 404s". Admin and account pages aren't indexed, so that cost doesn't
// apply here.
export default function AdminLoading() {
    return (
        <div role="status" className="flex justify-center py-20">
            <Spinner className="h-8 w-8 text-primary" />
        </div>
    )
}
