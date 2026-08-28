import type { WizardStep } from "./wizard-state"

const STEPS: { key: WizardStep; label: string }[] = [
    { key: "service", label: "Service" },
    { key: "artist", label: "Artist" },
    { key: "datetime", label: "Time" },
    { key: "review", label: "Confirm" },
]

export function StepIndicator({ current }: { current: WizardStep }) {
    const currentIndex = STEPS.findIndex((s) => s.key === current)

    return (
        <ol className="flex items-center gap-2">
            {STEPS.map((step, index) => {
                const isDone = currentIndex > index
                const isActive = currentIndex === index
                return (
                    <li key={step.key} className="flex flex-1 items-center gap-2">
                        <span
                            className={
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                                (isActive
                                    ? "bg-primary text-primary-foreground"
                                    : isDone
                                        ? "bg-primary/20 text-primary"
                                        : "bg-muted text-muted-foreground")
                            }
                        >
                            {index + 1}
                        </span>
                        {index < STEPS.length - 1 && (
                            <span
                                className={"h-0.5 flex-1 " + (isDone ? "bg-primary/40" : "bg-border")}
                                aria-hidden
                            />
                        )}
                    </li>
                )
            })}
        </ol>
    )
}
