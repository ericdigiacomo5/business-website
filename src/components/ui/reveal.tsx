'use client'

import { useEffect, useRef, type ReactNode } from "react"

// Fades a section up as it scrolls into view (FEATURE_GAPS.md U5).
//
// Rendered visible: the hidden state is only added after mount, and only to
// a section that's still below the fold, so the server HTML, no-JS visitors
// and anything already on screen never flash or stay hidden. The CSS for
// both classes lives under prefers-reduced-motion: no-preference in
// globals.css, so for reduced-motion visitors this does nothing at all.
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const element = ref.current
        if (!element || typeof IntersectionObserver === "undefined") return
        if (element.getBoundingClientRect().top < window.innerHeight) return

        element.classList.add("reveal-pending")
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    element.classList.add("reveal-shown")
                    element.classList.remove("reveal-pending")
                    observer.disconnect()
                }
            },
            { rootMargin: "0px 0px -10% 0px" }
        )
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    )
}
