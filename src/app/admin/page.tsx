import Link from "next/link"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AppointmentStatus, type Prisma } from "@/generated/prisma/client"
import { BookingFilters } from "@/components/admin/booking-filters"
import { ScheduleGrid } from "@/components/admin/schedule-grid"
import { DatePicker } from "@/components/admin/admin-date-picker"
import { MonthCalendar } from "@/components/admin/month-calendar"
import { ScheduleViewToggle } from "@/components/admin/schedule-view-toggle"
import { startOfDay, endOfDay, getWorkingWindows, getGridBounds, getTimeOffForDay } from "@/lib/availability"
import { parseScheduleView, startOfWeek, type ScheduleColumn } from "@/lib/schedule-grid"
import { addDays } from "@/lib/recurring"
import { toLocalDateKey, parseLocalDate } from "@/lib/format"
import { getPolicySettings, isBookingEnabled } from "@/lib/settings"
import { SERVICE_LINES_INCLUDE } from "@/lib/appointment-services"
import { SAFE_USER_SELECT_BASIC } from "@/lib/user-select"
import { requireAdminPage } from "@/lib/require-admin-page"
import { ARTIST_SERVICES_INCLUDE, offeredServiceIdsOf } from "@/lib/artist-services"
import { formatSalonDate } from "@/lib/salon-time"

export default async function AdminBookingsPage({
    searchParams,
}: {
    searchParams: Promise<{
        status?: string
        artistId?: string
        dateString?: string
        dateDown?: string
        dateUp?: string
        view?: string
    }>
}) {
    await requireAdminPage("/admin")

    const params = await searchParams
    const statusParam = params.status ?? ""
    const view = parseScheduleView(params.view)

    const parsedDate = params.dateString ? parseLocalDate(params.dateString) : null
    const date = parsedDate ?? new Date()

    // Inactive artists are hidden everywhere except admin/artists (where
    // they can be reactivated) — this dashboard, its filters, and the
    // schedule grid should never surface one. Read before the redirect
    // below, since the week view needs an artist to fall back to.
    const allArtists = await prisma.artist.findMany({
        where: { active: true },
        include: ARTIST_SERVICES_INCLUDE,
        orderBy: { createdAt: "asc" },
    })

    // The week view is one artist at a time: with none (or an unknown one)
    // chosen, it shows the first.
    const weekNeedsArtist = view === "week" && !allArtists.some((a) => a.id === params.artistId)
    const artistIdParam = weekNeedsArtist ? (allArtists[0]?.id ?? "") : (params.artistId ?? "")

    // The picker submits a delta (dateDown/dateUp), not a computed date —
    // the server does the arithmetic and redirects to a canonical
    // ?dateString= URL, same "default via redirect()" pattern already used
    // in admin/availability and admin/time-off. This also covers "no
    // dateString yet" and "malformed dateString" by falling back to today,
    // so the URL — not a transient delta — is always the source of truth
    // for which day is being viewed (survives a reload or a shared link).
    // In the week view a step is 7 days, keeping the same weekday selected.
    const delta = (params.dateDown ? -1 : params.dateUp ? 1 : 0) * (view === "week" ? 7 : 1)
    if (delta !== 0 || !parsedDate || (weekNeedsArtist && artistIdParam)) {
        const query = new URLSearchParams()
        query.set("dateString", toLocalDateKey(addDays(date, delta)))
        if (statusParam) query.set("status", statusParam)
        if (artistIdParam) query.set("artistId", artistIdParam)
        if (view === "week") query.set("view", "week")

        redirect(`/admin?${query.toString()}`)
    }

    // Day view: the selected day. Week view: Sunday–Saturday around it.
    const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)) : [date]

    const where: Prisma.AppointmentWhereInput = {
        startTime: {
            gte: startOfDay(days[0]),
            lte: endOfDay(days[days.length - 1]),
        },
    }

    if (statusParam && (Object.values(AppointmentStatus) as string[]).includes(statusParam)) {
        where.status = statusParam as AppointmentStatus
    } else {
        // No status filter selected — this is the grid's default, "what does
        // today actually look like" view. CANCELLED/NO_SHOW appointments no
        // longer hold a real AppointmentSlot (both free their slots on that
        // transition), so a rebooked time and its cancelled/no-show
        // predecessor would otherwise render as two blocks stacked in the
        // exact same grid cell, with one completely hiding the other. Hide
        // both terminal-and-vacated statuses here; picking "Cancelled" or
        // "No-Show" explicitly in the filter above still shows them, scoped
        // to just that status so there's no competing block to hide behind.
        where.status = { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] }
    }

    if (artistIdParam) {
        where.artistId = artistIdParam
    }

    const [appointments, services, bookingEnabled, policy] = await Promise.all([
        prisma.appointment.findMany({
            where,
            // Explicit select on `user`, never a bare include — Prisma returns
            // every scalar by default, and this result crosses into a Client
            // Component, so a bare include serializes passwordHash into the
            // browser's RSC payload.
            include: {
                artist: true,
                ...SERVICE_LINES_INCLUDE,
                user: { select: SAFE_USER_SELECT_BASIC },
            },
            orderBy: { startTime: "asc" },
        }),
        // For booking straight from the grid (clicking an open time).
        prisma.service.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
        isBookingEnabled(),
        getPolicySettings(),
    ])

    // The artistId filter already scopes `appointments` server-side above —
    // narrowing the schedule grid to a single column here too keeps that
    // truthful. Showing every column with only one populated would misleadingly
    // imply the others were verified empty, when their data was simply never
    // fetched.
    const artists = artistIdParam ? allArtists.filter((a) => a.id === artistIdParam) : allArtists
    const artistIds = artists.map((a) => a.id)

    // For the booking sheet's "not done by this artist" warning (Gap 23).
    const offeredServiceIds = Object.fromEntries(allArtists.map((a) => [a.id, offeredServiceIdsOf(a)]))

    // Lifetime no-shows for each customer on the page, for the detail
    // sheet's repeat no-show flag (Gap 28). One grouped query.
    const customerIds = [...new Set(appointments.map((a) => a.userId))]
    const noShowRows = customerIds.length
        ? await prisma.appointment.groupBy({
              by: ["userId"],
              where: { userId: { in: customerIds }, status: AppointmentStatus.NO_SHOW },
              _count: { _all: true },
          })
        : []
    const noShowCounts = Object.fromEntries(noShowRows.map((row) => [row.userId, row._count._all]))
    // One batched query per day (two in the day view, fourteen in the week
    // view — every artist's rows for a day come back in one query).
    const [workingWindowsByDay, timeOffByDay] = await Promise.all([
        Promise.all(days.map((day) => getWorkingWindows(artistIds, day))),
        Promise.all(days.map((day) => getTimeOffForDay(artistIds, day))),
    ])
    const gridBounds = getGridBounds(workingWindowsByDay.flat())

    const todayKey = toLocalDateKey(new Date())
    const colorIndexOf = (artistId: string) => allArtists.findIndex((a) => a.id === artistId)
    const columns: ScheduleColumn[] = days.flatMap((day, dayIndex) =>
        artists.map((artist) => ({
            artist,
            date: day,
            heading:
                view === "week"
                    ? formatSalonDate(day, { weekday: "short", month: "short", day: "numeric" })
                    : artist.name,
            isToday: view === "week" && toLocalDateKey(day) === todayKey,
            colorIndex: colorIndexOf(artist.id),
            workingWindow: workingWindowsByDay[dayIndex].find((w) => w.artistId === artist.id) ?? {
                artistId: artist.id,
                start: null,
                end: null,
            },
            timeOff: timeOffByDay[dayIndex].filter((t) => t.artistId === artist.id),
        }))
    )

    const dateKey = toLocalDateKey(date)
    const calendarProps = {
        selectedDateKey: dateKey,
        todayKey,
        status: statusParam,
        artistId: artistIdParam,
        scheduleView: view,
    }

    return (
        <div>
            {/* The switch itself lives on Settings; this keeps a closed
                booking from going unnoticed on the page staff use most. */}
            {!bookingEnabled && (
                <p role="status" className="mb-4 rounded-sm border border-danger px-3 py-2 text-sm text-foreground">
                    Online booking is closed — customers can&apos;t book themselves.{" "}
                    <Link href="/admin/settings" className="font-medium">
                        Change in Settings
                    </Link>
                </p>
            )}
            <BookingFilters
                artists={allArtists}
                currentStatus={statusParam}
                currentArtistId={artistIdParam}
                currentDateString={toLocalDateKey(date)}
                view={view}
            />
            {/* Month calendar beside the grid on desktop; collapsed above it
                on mobile so it doesn't push the schedule below the fold.
                Two instances rather than one CSS-repositioned one: the mobile
                version needs to live inside <details>. */}
            <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
                {/* mt-4 lines the panel up with DatePicker's own top margin.
                    Keyed on the selected day so the browsed month resets to
                    it after any navigation (e.g. "Jump to today"). */}
                <aside className="hidden lg:mt-4 lg:block">
                    <MonthCalendar key={dateKey} {...calendarProps} />
                </aside>

                <div className="min-w-0">
                    <details className="mt-4 lg:hidden">
                        <summary className="flex h-11 cursor-pointer items-center text-sm font-medium text-foreground">
                            Jump to a date
                        </summary>
                        <div className="mt-2">
                            <MonthCalendar key={dateKey} {...calendarProps} />
                        </div>
                    </details>

                    <ScheduleViewToggle
                        view={view}
                        dateString={dateKey}
                        status={statusParam}
                        artistId={artistIdParam}
                        defaultArtistId={allArtists[0]?.id ?? null}
                    />
                    <DatePicker date={date} status={statusParam} artistId={artistIdParam} view={view} />
                    {/* Keyed on the view: ScheduleGrid seeds local state from
                        initialAppointments once, and the calendar's links are
                        client-side navigations (unlike DatePicker's form, a
                        full reload) — without the key, switching days would
                        keep showing the previous day's appointments. */}
                    <ScheduleGrid
                        key={`${view}|${dateKey}|${statusParam}|${artistIdParam}`}
                        initialAppointments={appointments}
                        view={view}
                        columns={columns}
                        services={services}
                        offeredServiceIds={offeredServiceIds}
                        noShowCounts={noShowCounts}
                        gridBounds={gridBounds}
                        maxSeriesWeeks={policy.maxSeriesWeeks}
                    />
                </div>
            </div>
        </div>
    )
}