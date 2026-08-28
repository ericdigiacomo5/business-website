import type { Appointment, RecurringAppointment } from "@/generated/prisma/client"

export type WizardStep = "service" | "artist" | "datetime" | "review" | "confirmed"

export type RecurringBookingResult = {
    recurringAppointment: RecurringAppointment
    created: Appointment[]
    skipped: { date: string; reason: string }[]
}

export type WizardState = {
    step: WizardStep
    serviceId: string | null
    artistId: string | null
    date: string | null // 'YYYY-MM-DD'
    startTime: string | null // full ISO string
    confirmedAppointment: Appointment | null
    confirmedRecurring: RecurringBookingResult | null
}

export type WizardSelection = Pick<WizardState, "serviceId" | "artistId" | "date" | "startTime">

export type WizardAction =
    | { type: "SELECT_SERVICE"; serviceId: string }
    | { type: "SELECT_ARTIST"; artistId: string }
    | { type: "SELECT_DATETIME"; date: string; startTime: string }
    | { type: "GO_BACK" }
    | { type: "SUBMIT_SUCCESS"; appointment: Appointment }
    | { type: "SUBMIT_RECURRING_SUCCESS"; result: RecurringBookingResult }
    | { type: "SLOT_UNAVAILABLE" }
    | { type: "HYDRATE"; selection: WizardSelection }
    | { type: "RESET" }

// The same "what's the furthest step this partial selection supports" logic
// answers both "the user arrived via ?serviceId=/?artistId= query params" and
// "we're rehydrating from sessionStorage after a login redirect."
export function computeInitialStep(selection: Partial<WizardSelection>): WizardStep {
    if (selection.serviceId && selection.artistId && selection.date && selection.startTime) {
        return "review"
    }
    if (selection.serviceId && selection.artistId) {
        return "datetime"
    }
    if (selection.serviceId) {
        return "artist"
    }
    return "service"
}

export function initialWizardState(selection: Partial<WizardSelection>): WizardState {
    return {
        step: computeInitialStep(selection),
        serviceId: selection.serviceId ?? null,
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
        case "SELECT_SERVICE":
            return { ...state, serviceId: action.serviceId, step: "artist" }
        case "SELECT_ARTIST":
            return { ...state, artistId: action.artistId, step: "datetime" }
        case "SELECT_DATETIME":
            return { ...state, date: action.date, startTime: action.startTime, step: "review" }
        case "GO_BACK":
            return { ...state, step: previousStep(state.step) }
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
                step: computeInitialStep(action.selection),
            }
        case "RESET":
            return initialWizardState({})
        default:
            return state
    }
}
