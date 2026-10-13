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

const STORAGE_KEY = "booking-wizard"

export function BookingWizard({
    initialServices,
    initialArtists,
    initialServiceId,
    initialArtistId,
}: {
    initialServices: Service[]
    initialArtists: Artist[]
    initialServiceId: string | null
    initialArtistId: string | null
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
            const artistOk = !selection.artistId || initialArtists.some((a) => a.id === selection.artistId)
            if (serviceOk && artistOk) {
                dispatch({ type: "HYDRATE", selection })
            }
        } catch {
            // Malformed storage — ignore, start fresh.
        }
    }, [status, initialServices, initialArtists])

    function redirectToLogin() {
        const selection: WizardSelection = {
            serviceIds: state.serviceIds,
            artistId: state.artistId,
            date: state.date,
            startTime: state.startTime,
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
        router.push("/login?callbackUrl=/book")
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
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                ) : (
                    <ConfirmedStep
                        appointment={state.confirmedAppointment!}
                        services={selectedServices}
                        artist={selectedArtist}
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <div className="mb-8 text-center">
                <span className="font-script text-2xl text-accent">Let&apos;s get you</span>
                <h1 className="mt-0.5 font-serif text-3xl font-extrabold text-foreground">Booked In</h1>
            </div>
            <StepIndicator current={state.step} />

            <div className="mt-8">
                {state.step === "service" && (
                    <div className="pb-28">
                        <ServiceStep
                            services={initialServices}
                            selectedIds={state.serviceIds}
                            onToggle={(serviceId) => dispatch({ type: "TOGGLE_SERVICE", serviceId })}
                        />
                        <StickyActionBar>
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
                    <div className="pb-28">
                        <ArtistStep
                            artists={initialArtists}
                            selectedId={state.artistId}
                            onSelect={(artistId) => dispatch({ type: "SELECT_ARTIST", artistId })}
                        />
                        <StickyActionBar>
                            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "GO_BACK" })}>
                                Back
                            </Button>
                        </StickyActionBar>
                    </div>
                )}

                {state.step === "datetime" && selectedArtist && selectedServices.length > 0 && (
                    <div className="pb-28">
                        <DateTimeStep
                            artistId={selectedArtist.id}
                            initialDate={state.date}
                            // Only times where every service fits back to back.
                            serviceDurationMinutes={selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0)}
                            onSelect={(date, startTime) => dispatch({ type: "SELECT_DATETIME", date, startTime })}
                        />
                        <StickyActionBar>
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
