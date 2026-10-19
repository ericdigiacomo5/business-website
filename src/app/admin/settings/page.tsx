import { BookingToggle } from "@/components/admin/booking-toggle"
import { PolicySettingsForm } from "@/components/admin/policy-settings"
import { getPolicySettings, isBookingEnabled } from "@/lib/settings"

// Salon-wide settings (AppSettings): the online booking switch and the
// booking policies. Both cards save through PATCH /api/admin/settings.
export default async function AdminSettingsPage() {
    const [bookingEnabled, policy] = await Promise.all([isBookingEnabled(), getPolicySettings()])

    return (
        <div className="flex flex-col gap-4">
            <BookingToggle initialEnabled={bookingEnabled} />
            <PolicySettingsForm initial={policy} />
        </div>
    )
}
