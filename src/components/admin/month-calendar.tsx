'use client'

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { parseLocalDate, toLocalDateKey } from "@/lib/format"
import type { ScheduleView } from "@/lib/schedule-grid"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

// Month-view jump-to-date for the admin schedule (Roadmap item 14). Each day
// is a plain link to `/admin?dateString=...`, so the URL stays the single
// source of truth for which day is shown — same as the prev/next arrows —
// and a reload or shared link still lands on the same day. The only client
// state is which *month* is being browsed, which nothing else needs to know.
//
// The arithmetic here is pure calendar math on year/month/day values
// (`new Date(y, m, d)`), never on instants, so it's unaffected by the
// timezone issue flagged for the Cloudflare deploy.
export function MonthCalendar({
    selectedDateKey,
    todayKey,
    status,
    artistId,
    scheduleView,
}: {
    selectedDateKey: string
    // Passed from the server so server and client render the same "today"
    // (computing it in the browser could disagree right around midnight and
    // cause a hydration mismatch).
    todayKey: string
    status: string
    artistId: string
    // Day or week — carried so picking a date doesn't switch layouts.
    scheduleView: ScheduleView
}) {
    const selected = parseLocalDate(selectedDateKey) ?? new Date()
    const [view, setView] = useState({ year: selected.getFullYear(), month: selected.getMonth() })

    const firstWeekday = new Date(view.year, view.month, 1).getDay()
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    })

    function shiftMonth(delta: number) {
        // Date normalizes month -1 / 12 into the neighboring year.
        const d = new Date(view.year, view.month + delta, 1)
        setView({ year: d.getFullYear(), month: d.getMonth() })
    }

    // Carry the active filters along, same reason DatePicker and
    // BookingFilters carry each other's fields: a date change shouldn't
    // silently reset the status/artist filter.
    function hrefFor(dateKey: string) {
        const params = new URLSearchParams({ dateString: dateKey })
        if (status) params.set("status", status)
        if (artistId) params.set("artistId", artistId)
        if (scheduleView === "week") params.set("view", "week")
        return `/admin?${params.toString()}`
    }

    const cells: (number | null)[] = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]

    return (
        <div className="rounded-sm border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span aria-live="polite" className="text-sm font-medium text-surface-foreground">
                    {monthLabel}
                </span>
                <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-9 lg:w-9"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-2 grid grid-cols-7 text-center text-xs text-muted-foreground" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                    <span key={day} className="py-1">
                        {day}
                    </span>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                    if (day === null) return <span key={`blank-${i}`} />

                    const date = new Date(view.year, view.month, day)
                    const key = toLocalDateKey(date)
                    const isSelected = key === selectedDateKey
                    const isToday = key === todayKey

                    return (
                        <Link
                            key={key}
                            href={hrefFor(key)}
                            // A month has ~30 day links, and prefetching each
                            // would server-render ~30 schedule pages (each
                            // with its own DB queries) on every visit.
                            prefetch={false}
                            aria-label={date.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                            aria-current={isSelected ? "date" : undefined}
                            className={
                                "flex h-11 items-center justify-center rounded-sm text-sm transition-colors lg:h-9 " +
                                (isSelected
                                    ? "bg-primary font-semibold text-primary-foreground"
                                    : isToday
                                      ? "border border-primary font-semibold text-surface-foreground hover:bg-muted"
                                      : "text-surface-foreground hover:bg-muted")
                            }
                        >
                            {day}
                        </Link>
                    )
                })}
            </div>

            {selectedDateKey !== todayKey && (
                <Link
                    href={hrefFor(todayKey)}
                    prefetch={false}
                    className="mt-2 flex h-11 items-center justify-center rounded-sm text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground lg:h-9"
                >
                    Jump to today
                </Link>
            )}
        </div>
    )
}
