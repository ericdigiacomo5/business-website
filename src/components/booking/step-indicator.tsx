import type { WizardStep } from "./wizard-state"

const STEPS: { key: WizardStep; label: string }[] = [
    { key: "service", label: "Service" },
    { key: "artist", label: "Artist" },
    { key: "datetime", label: "Time" },
    { key: "review", label: "Confirm" },
]

export function StepIndicator({
    current,
    onSelect,
}: {
    current: WizardStep
    // Jump back to a step already done (FEATURE_GAPS.md U6). Only earlier
    // steps are offered — later ones need the choices in between.
    onSelect?: (step: WizardStep) => void
}) {
    const steps = STEPS
    const currentIndex = steps.findIndex((s) => s.key === current)

    return (
        // The circles show only numbers, so each step also carries its name
        // and state as screen-reader text, and the current one is marked
        // aria-current (FEATURE_GAPS.md Gap 36).
        <ol aria-label="Booking steps" className="flex items-center gap-2">
            {steps.map((step, index) => {
                const isDone = currentIndex > index
                const isActive = currentIndex === index
                const isLast = index === steps.length - 1
                const circle =
                    "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-jost text-[13px] font-bold " +
                    (isActive
                        ? "bg-lacquer text-lacquer-foreground shadow-md ring-4 ring-lacquer/15"
                        : isDone
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-foreground")
                const srText = `Step ${index + 1} of ${steps.length}: ${step.label}${isDone ? ", done" : isActive ? ", current step" : ""}`
                return (
                    <li
                        key={step.key}
                        aria-current={isActive ? "step" : undefined}
                        className={"flex items-center gap-2 " + (isLast ? "flex-none" : "flex-1")}
                    >
                        {isDone && onSelect ? (
                            // 44px tap target around the 30px circle.
                            <button
                                type="button"
                                onClick={() => onSelect(step.key)}
                                title={`Back to ${step.label}`}
                                className="-m-1.75 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:opacity-80"
                            >
                                <span aria-hidden className={circle}>
                                    {index + 1}
                                </span>
                                <span className="sr-only">{`${srText}. Go back to this step`}</span>
                            </button>
                        ) : (
                            <>
                                <span aria-hidden title={step.label} className={circle}>
                                    {index + 1}
                                </span>
                                <span className="sr-only">{srText}</span>
                            </>
                        )}
                        {index < steps.length - 1 && (
                            <span
                                className={"h-0.5 flex-1 " + (isDone ? "bg-accent" : "bg-muted")}
                                aria-hidden
                            />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
