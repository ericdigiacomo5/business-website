import type { WizardStep } from "./wizard-state"

function getSteps(adminMode: boolean): { key: WizardStep; label: string }[] {
    return [
        ...(adminMode ? [{ key: "user" as const, label: "Customer" }] : []),
        { key: "service" as const, label: "Service" },
        { key: "artist" as const, label: "Artist" },
        { key: "datetime" as const, label: "Time" },
        { key: "review" as const, label: "Confirm" },
    ]
}

export function StepIndicator({ current, adminMode = false }: { current: WizardStep; adminMode?: boolean }) {
    const steps = getSteps(adminMode)
    const currentIndex = steps.findIndex((s) => s.key === current)

    return (
        <ol className="flex items-center gap-2">
            {steps.map((step, index) => {
                const isDone = currentIndex > index
                const isActive = currentIndex === index
                const isLast = index === steps.length - 1
                return (
                    <li
                        key={step.key}
                        className={"flex items-center gap-2 " + (isLast ? "flex-none" : "flex-1")}
                    >
                        <span
                            className={
                                "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-jost text-[13px] font-bold " +
                                (isActive || isDone
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-muted text-muted-foreground")
                            }
                        >
                            {index + 1}
                        </span>
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
