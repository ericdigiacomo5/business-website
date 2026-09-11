import type { Appointment, RecurringAppointment } from "@/generated/prisma/client"

export type WizardStep = "user" | "service" | "artist" | "datetime" | "review" | "confirmed"

export type RecurringBookingResult = {
    recurringAppointment: RecurringAppointment
    created: Appointment[]
    skipped: { date: string; reason: string }[]
}

export type SelectedUser = {
    id: string
    name: string | null
    email: string
    phone: string
}

export type WizardState = {
    adminMode: boolean
    step: WizardStep
    selectedUser: SelectedUser | null
    serviceId: string | null
    artistId: string | null
    date: string | null // 'YYYY-MM-DD'
    startTime: string | null // full ISO string
    confirmedAppointment: Appointment | null
    confirmedRecurring: RecurringBookingResult | null
}

export type WizardSelection = Pick<WizardState, "serviceId" | "artistId" | "date" | "startTime">

export type WizardAction =
    | { type: "SELECT_USER"; user: SelectedUser }
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
// "we're rehydrating from sessionStorage after a login redirect." Admin mode
// never rehydrates this way (see booking-wizard.tsx), so it always starts at
// "user" regardless of a passed-in selection.
export function computeInitialStep(selection: Partial<WizardSelection>, adminMode: boolean): WizardStep {
    if (adminMode) {
        return "user"
    }
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

export function initialWizardState(
    selection: Partial<WizardSelection>,
    adminMode: boolean = false
): WizardState {
    return {
        adminMode,
        step: computeInitialStep(selection, adminMode),
        selectedUser: null,
        serviceId: selection.serviceId ?? null,
        artistId: selection.artistId ?? null,
        date: selection.date ?? null,
        startTime: selection.startTime ?? null,
        confirmedAppointment: null,
        confirmedRecurring: null,
    }
}

function stepOrder(adminMode: boolean): WizardStep[] {
    return adminMode
        ? ["user", "service", "artist", "datetime", "review"]
        : ["service", "artist", "datetime", "review"]
}

function previousStep(step: WizardStep, adminMode: boolean): WizardStep {
    const order = stepOrder(adminMode)
    const index = order.indexOf(step)
    return index > 0 ? order[index - 1] : step
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
    switch (action.type) {
        case "SELECT_USER":
            return { ...state, selectedUser: action.user, step: "service" }
        case "SELECT_SERVICE":
            return { ...state, serviceId: action.serviceId, step: "artist" }
        case "SELECT_ARTIST":
            return { ...state, artistId: action.artistId, step: "datetime" }
        case "SELECT_DATETIME":
            return { ...state, date: action.date, startTime: action.startTime, step: "review" }
        case "GO_BACK":
            return { ...state, step: previousStep(state.step, state.adminMode) }
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
                step: computeInitialStep(action.selection, state.adminMode),
            }
        case "RESET":
            return initialWizardState({}, state.adminMode)
        default:
            return state
    }
}
