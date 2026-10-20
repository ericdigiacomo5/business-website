import type { Appointment, RecurringAppointment } from "@/generated/prisma/client"
import type { ServiceLine } from "@/lib/appointment-services"

export type WizardStep = "service" | "artist" | "datetime" | "review" | "confirmed"

// What the booking routes return: the appointment plus its service lines.
export type BookedAppointment = Appointment & { services: ServiceLine[] }

export type RecurringBookingResult = {
    recurringAppointment: RecurringAppointment
    created: BookedAppointment[]
    skipped: { date: string; reason: string }[]
}

// The customer an admin is booking for (see the admin schedule grid's
// ScheduleBookSheet) — not part of this wizard's own state.
export type SelectedUser = {
    id: string
    name: string | null
    email: string
    phone: string
    // Lifetime no-shows, when picked from the customer search (a walk-in
    // just created has none).
    noShowCount?: number
}

export type WizardState = {
    step: WizardStep
    // One or more, in the order they were picked.
    serviceIds: string[]
    artistId: string | null
    date: string | null // 'YYYY-MM-DD'
    startTime: string | null // full ISO string
    confirmedAppointment: BookedAppointment | null
    confirmedRecurring: RecurringBookingResult | null
}

export type WizardSelection = Pick<WizardState, "serviceIds" | "artistId" | "date" | "startTime">

export type WizardAction =
    | { type: "TOGGLE_SERVICE"; serviceId: string }
    | { type: "CONFIRM_SERVICES" }
    | { type: "SELECT_ARTIST"; artistId: string }
    | { type: "SELECT_DATETIME"; date: string; startTime: string }
    | { type: "GO_BACK" }
    // Jump back to an earlier step (the step indicator). Later steps are
    // ignored: they need the choices in between.
    | { type: "GO_TO"; step: WizardStep }
    // After a booking: same services and artist, pick a new time.
    | { type: "BOOK_AGAIN" }
    | { type: "SUBMIT_SUCCESS"; appointment: BookedAppointment }
    | { type: "SUBMIT_RECURRING_SUCCESS"; result: RecurringBookingResult }
    | { type: "SLOT_UNAVAILABLE" }
    | { type: "HYDRATE"; selection: WizardSelection }
    | { type: "RESET" }

// The same "what's the furthest step this partial selection supports" logic
// answers both "the user arrived via ?serviceId=/?artistId= query params" and
// "we're rehydrating from sessionStorage after a login redirect."
export function computeInitialStep(selection: Partial<WizardSelection>): WizardStep {
    const hasServices = (selection.serviceIds?.length ?? 0) > 0
    if (hasServices && selection.artistId && selection.date && selection.startTime) {
        return "review"
    }
    if (hasServices && selection.artistId) {
        return "datetime"
    }
    if (hasServices) {
        return "artist"
    }
    return "service"
}

export function initialWizardState(selection: Partial<WizardSelection>): WizardState {
    return {
        step: computeInitialStep(selection),
        serviceIds: selection.serviceIds ?? [],
        artistId: selection.artistId ?? null,
        date: selection.date ?? null,
        startTime: selection.startTime ?? null,
        confirmedAppointment: null,
        confirmedRecurring: null,
    }
}

const STEP_ORDER: WizardStep[] = ["service", "artist", "datetime", "review"]

function previousStep(step: WizardStep): WizardStep {
    const index = STEP_ORDER.indexOf(step)
    return index > 0 ? STEP_ORDER[index - 1] : step
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case "TOGGLE_SERVICE": {
            // Picking a service no longer advances on its own — there may be
            // more to add. Changing the services changes how long the
            // appointment is, so a time picked for the old set is dropped.
            const serviceIds = state.serviceIds.includes(action.serviceId)
                ? state.serviceIds.filter((id) => id !== action.serviceId)
                : [...state.serviceIds, action.serviceId]
            return { ...state, serviceIds, date: null, startTime: null }
        }
        case "CONFIRM_SERVICES":
            return state.serviceIds.length > 0 ? { ...state, step: "artist" } : state
        case "SELECT_ARTIST":
            return { ...state, artistId: action.artistId, step: "datetime" }
        case "SELECT_DATETIME":
            return { ...state, date: action.date, startTime: action.startTime, step: "review" }
        case "GO_BACK":
            return { ...state, step: previousStep(state.step) }
        case "GO_TO":
            return STEP_ORDER.indexOf(action.step) < STEP_ORDER.indexOf(state.step) ? { ...state, step: action.step } : state
        case "BOOK_AGAIN":
            return {
                ...initialWizardState({ serviceIds: state.serviceIds, artistId: state.artistId }),
                step: state.serviceIds.length > 0 && state.artistId ? "datetime" : "service",
            }
        case "SUBMIT_SUCCESS":
            return { ...state, step: "confirmed", confirmedAppointment: action.appointment, confirmedRecurring: null }
        case "SUBMIT_RECURRING_SUCCESS":
            return { ...state, step: "confirmed", confirmedAppointment: null, confirmedRecurring: action.result }
        case "SLOT_UNAVAILABLE":
            return { ...state, step: "datetime", startTime: null }
        case "HYDRATE":
            return {
                ...state,
                ...action.selection,
                // A selection saved before multi-service booking has no
                // serviceIds; treat it as empty rather than crash.
                serviceIds: action.selection.serviceIds ?? [],
                step: computeInitialStep(action.selection),
            }
        case "RESET":
            return initialWizardState({})
        default:
            return state
    }
}
