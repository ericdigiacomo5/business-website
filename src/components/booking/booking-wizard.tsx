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
        { serviceId: initialServiceId, artistId: initialArtistId, date: null, startTime: null },
        initialWizardState
    )


    useEffect(() => {
        if (status === "loading") return // don't act on a guess

        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (!raw) return
        sessionStorage.removeItem(STORAGE_KEY)

        if (status !== "authenticated") return // abandoned login attempt — discard, don't resume

        try {
            const selection: WizardSelection = JSON.parse(raw)
            const serviceOk = !selection.serviceId || initialServices.some((s) => s.id === selection.serviceId)
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
            serviceId: state.serviceId,
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

    const selectedService = initialServices.find((s) => s.id === state.serviceId) ?? null
    const selectedArtist = initialArtists.find((a) => a.id === state.artistId) ?? null

    if (
        state.step === "confirmed" &&
        (state.confirmedAppointment || state.confirmedRecurring) &&
        selectedService &&
        selectedArtist
    ) {
        return (
            <div className="mx-auto max-w-lg px-4 py-12">
                {state.confirmedRecurring ? (
                    <ConfirmedStep
                        recurringResult={state.confirmedRecurring}
                        service={selectedService}
                        artist={selectedArtist}
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                ) : (
                    <ConfirmedStep
                        appointment={state.confirmedAppointment!}
                        service={selectedService}
                        artist={selectedArtist}
                        onBookAnother={() => dispatch({ type: "RESET" })}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8">
            <StepIndicator current={state.step} />

            <div className="mt-8">
                {state.step === "service" && (
                    <ServiceStep
                        services={initialServices}
                        selectedId={state.serviceId}
                        onSelect={(serviceId) => dispatch({ type: "SELECT_SERVICE", serviceId })}
                    />
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

                {state.step === "datetime" && selectedArtist && selectedService && (
                    <div className="pb-28">
                        <DateTimeStep
                            artistId={selectedArtist.id}
                            initialDate={state.date}
                            serviceDurationMinutes={selectedService.durationMinutes}
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
                    (status === "authenticated" && selectedService && selectedArtist && state.startTime ? (
                        <ReviewStep
                            service={selectedService}
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
