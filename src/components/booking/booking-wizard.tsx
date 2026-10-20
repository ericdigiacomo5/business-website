'use client'

import { useEffect, useReducer } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type { Artist, Service } from "@/generated/prisma/client"
import { wizardReducer, initialWizardState, type WizardSelection } from "./wizard-state"
import { StepIndicator } from "./step-indicator"
import { ServiceStep } from "./steps/service-step"
import { ArtistStep } from "./steps/artist-step"
import { DateTimeStep } from "./steps/datetime-step"
import { ReviewStep } from "./steps/review-step"
import { ConfirmedStep } from "./steps/confirmed-step"
import { StickyActionBar } from "@/components/ui/sticky-action-bar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { artistOffersAll, servicesNotOffered } from "@/lib/artist-services"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { formatDuration, formatPrice } from "@/lib/format"

const STORAGE_KEY = "booking-wizard"

// What's picked so far, kept in view in the sticky bar on every step
// (FEATURE_GAPS.md U6) — services, length and price, and the artist once
// chosen.
function BookingSummary({ services, artist }: { services: Service[]; artist: Artist | null }) {
    if (services.length === 0) return null
    const minutes = services.reduce((sum, s) => sum + s.durationMinutes, 0)
    const cents = services.reduce((sum, s) => sum + s.priceCents, 0)
    return (
        <div className="mb-2 flex items-center gap-2 text-sm text-foreground">
            {artist && (
                <CloudinaryImage src={artist.photoUrl} alt="" sizes="28px" className="h-7 w-7 shrink-0 rounded-full border border-accent" />
            )}
            <p className="min-w-0 truncate">
                {`${services.length} service${services.length === 1 ? "" : "s"} · ${formatDuration(minutes)} · ${formatPrice(cents)}${artist ? ` · ${artist.name}` : ""}`}
            </p>
        </div>
    )
}

export function BookingWizard({
    initialServices,
    initialArtists,
    offeredServiceIds,
    initialServiceId,
    initialArtistId,
    maxSeriesWeeks,
    cancellationNoticeHours,
}: {
    initialServices: Service[]
    initialArtists: Artist[]
    // artistId → the services they perform; [] = every service.
    offeredServiceIds: Record<string, string[]>
    initialServiceId: string | null
    initialArtistId: string | null
    maxSeriesWeeks: number
    // The salon's live cancellation window, for the confirmation's policy line.
    cancellationNoticeHours: number
}) {
    const router = useRouter()
    const { data: session, status } = useSession()

    const [state, dispatch] = useReducer(
        wizardReducer,
        {
            // A "Book this service" deep link preselects one; more can be
            // added by going back to the service step.
            serviceIds: initialServiceId ? [initialServiceId] : [],
            artistId: initialArtistId,
            date: null,
            startTime: null,
        },
        (selection) => initialWizardState(selection)
    )


    useEffect(() => {
        if (status === "loading") return // don't act on a guess

        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return
        sessionStorage.removeItem(STORAGE_KEY)

        if (status !== "authenticated") return // abandoned login attempt — discard, don't resume

        try {
            const selection: WizardSelection = JSON.parse(raw)
            const serviceOk = (selection.serviceIds ?? []).every((id) => initialServices.some((s) => s.id === id))
            const artistOk =
                !selection.artistId ||
                (initialArtists.some((a) => a.id === selection.artistId) &&
                    artistOffersAll(offeredServiceIds[selection.artistId] ?? [], selection.serviceIds ?? []))
            if (serviceOk && artistOk) {
                dispatch({ type: "HYDRATE", selection })
            }
        } catch {
            // Malformed storage — ignore, start fresh.
        }
    }, [status, initialServices, initialArtists, offeredServiceIds])

    function redirectToLogin() {
        saveSelectionAndGo("/login?callbackUrl=/book")
    }

    // A signed-in customer with no name/phone on file fixes it on My Profile,
    // which sends them back here; the rehydrate effect above restores picks.
    function redirectToProfile() {
        saveSelectionAndGo("/account?callbackUrl=/book")
    }

    function saveSelectionAndGo(url: string) {
        const selection: WizardSelection = {
            serviceIds: state.serviceIds,
            artistId: state.artistId,
            date: state.date,
            startTime: state.startTime,
        }
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
        } catch {
            // Storage unavailable (e.g. some private-browsing modes) — the
            // redirect still works, the picks just aren't restored after it.
        }
        router.push(url)
    }

    // Reaching review unauthenticated (arrived here directly, or the session
    // expired while browsing steps 1-3) triggers the same persist+redirect.
    useEffect(() => {
        if (state.step === "review" && status === "unauthenticated") {
            redirectToLogin()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.step, status])

    // In the order they were picked, which is the order they're booked in.
    const selectedServices = state.serviceIds
        .map((id) => initialServices.find((s) => s.id === id))
        .filter((s): s is Service => s !== undefined)
    const selectedArtist = initialArtists.find((a) => a.id === state.artistId) ?? null

    // Only artists who perform every chosen service (FEATURE_GAPS.md Gap
    // 23); the booking routes refuse the rest.
    const eligibleArtists = initialArtists.filter((artist) =>
        artistOffersAll(offeredServiceIds[artist.id] ?? [], state.serviceIds)
    )
    // Arrived from an artist's page: mark the services they don't do, so
    // picking one isn't a surprise at the next step.
    const notOfferedByArtist = selectedArtist
        ? servicesNotOffered(offeredServiceIds[selectedArtist.id] ?? [], initialServices.map((s) => s.id))
        : []

    if (
        state.step === "confirmed" &&
        (state.confirmedAppointment || state.confirmedRecurring) &&
        selectedServices.length > 0 &&
        selectedArtist
    ) {
        return (
            <div className="mx-auto max-w-lg px-4 py-12">
                {state.confirmedRecurring ? (
                    <ConfirmedStep
                        recurringResult={state.confirmedRecurring}
                        services={selectedServices}
                        artist={selectedArtist}
                        cancellationNoticeHours={cancellationNoticeHours}
                        onBookAgain={() => dispatch({ type: "BOOK_AGAIN" })}
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                ) : (
                    <ConfirmedStep
                        appointment={state.confirmedAppointment!}
                        services={selectedServices}
                        artist={selectedArtist}
                        cancellationNoticeHours={cancellationNoticeHours}
                        onBookAgain={() => dispatch({ type: "BOOK_AGAIN" })}
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="mb-8 text-center">
                <span className="font-script text-2xl text-lacquer">Let&apos;s get you</span>
                <h1 className="mt-0.5 font-serif text-3xl font-extrabold text-foreground">Booked In</h1>
            </div>
            <StepIndicator current={state.step} onSelect={(step) => dispatch({ type: "GO_TO", step })} />

            <div className="mt-8">
                {state.step === "service" && (
                    <div className="pb-36">
                        <ServiceStep
                            services={initialServices}
                            selectedIds={state.serviceIds}
                            notOfferedIds={notOfferedByArtist}
                            notOfferedLabel={selectedArtist ? `Not done by ${selectedArtist.name}` : undefined}
                            onToggle={(serviceId) => dispatch({ type: "TOGGLE_SERVICE", serviceId })}
                        />
                        <StickyActionBar>
                            <BookingSummary services={selectedServices} artist={null} />
                            <Button
                                type="button"
                                onClick={() => dispatch({ type: "CONFIRM_SERVICES" })}
                                disabled={state.serviceIds.length === 0}
                                className="w-full"
                            >
                                Continue
                            </Button>
                        </StickyActionBar>
                    </div>
                )}

                {state.step === "artist" && (
                    <div className="pb-36">
                        <ArtistStep
                            artists={eligibleArtists}
                            selectedId={state.artistId}
                            onSelect={(artistId) => dispatch({ type: "SELECT_ARTIST", artistId })}
                        />
                        <StickyActionBar>
                            <BookingSummary services={selectedServices} artist={null} />
                            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "GO_BACK" })}>
                                Back
                            </Button>
                        </StickyActionBar>
                    </div>
                )}

                {state.step === "datetime" && selectedArtist && selectedServices.length > 0 && (
                    <div className="pb-36">
                        <DateTimeStep
                            artistId={selectedArtist.id}
                            initialDate={state.date}
                            // Only times where every service fits back to back.
                            serviceDurationMinutes={selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0)}
                            onSelect={(date, startTime) => dispatch({ type: "SELECT_DATETIME", date, startTime })}
                        />
                        <StickyActionBar>
                            <BookingSummary services={selectedServices} artist={selectedArtist} />
                            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "GO_BACK" })}>
                                Back
                            </Button>
                        </StickyActionBar>
                    </div>
                )}

                {state.step === "review" &&
                    (status === "authenticated" && selectedServices.length > 0 && selectedArtist && state.startTime ? (
                        <ReviewStep
                            services={selectedServices}
                            artist={selectedArtist}
                            startTime={state.startTime}
                            userLabel={session?.user?.email ?? session?.user?.name ?? "you"}
                            maxSeriesWeeks={maxSeriesWeeks}
                            profileIncomplete={session?.user?.profileIncomplete ?? false}
                            emailUnverified={session?.user?.emailUnverified ?? false}
                            onCompleteProfile={redirectToProfile}
                            onBack={() => dispatch({ type: "GO_BACK" })}
                            onSuccess={(appointment) => dispatch({ type: "SUBMIT_SUCCESS", appointment })}
                            onRecurringSuccess={(result) => dispatch({ type: "SUBMIT_RECURRING_SUCCESS", result })}
                            onSlotUnavailable={() => dispatch({ type: "SLOT_UNAVAILABLE" })}
                            onUnauthenticated={redirectToLogin}
                        />
                    ) : (
                        <div className="flex justify-center py-16">
                            <Spinner className="h-6 w-6 text-primary" />
                        </div>
                    ))}
            </div>
        </div>
    )
}
