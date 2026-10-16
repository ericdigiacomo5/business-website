import { Spinner } from "@/components/ui/spinner"

// Shown while My Bookings loads. See src/app/admin/loading.tsx for why
// loading states are only added to signed-in pages.
export default function AppointmentsLoading() {
    return (
        <div role="status" className="flex justify-center py-20">
            <Spinner className="h-8 w-8 text-primary" />
        </div>
    )
}
