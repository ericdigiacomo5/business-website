'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { CalendarClock, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { CloudinaryImage } from "@/components/ui/cloudinary-image"
import { buttonVariants } from "@/components/ui/button"

// One artist as the carousel shows them. `nextOpeningLabel` is formatted on
// the server, so the time reads the same in the HTML and after hydration.
export type CarouselArtist = {
    id: string
    name: string
    bio: string | null
    photoUrl: string | null
    specialties: string[]
    nextOpeningLabel: string
}

// Swipes shorter than this don't turn the ring.
const SWIPE_PX = 40

// How far the ring is tipped towards the viewer, so the cards behind show
// above the one in front.
const TILT_DEG = 14
const TILT_SIN = Math.sin((TILT_DEG * Math.PI) / 180)
const TILT_COS = Math.cos((TILT_DEG * Math.PI) / 180)

// How long each artist stays in front while the ring turns by itself, and
// how often the auto-turn checks whether it's being held.
const AUTO_TURN_MS = 5000
const TICK_MS = 250

// Whether the visitor has asked their OS for less motion. Read through
// useSyncExternalStore so it's false on the server (no window there) and
// follows the setting live in the browser.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia(REDUCED_MOTION)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches

function initials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

// The home page's "Meet the Artists": the cards sit on a ring that turns,
// one card in front and in full focus, the rest smaller, dimmer and a
// little blurred as they travel round behind it.
//
// How it moves: each card is placed with rotateY(angle) translateZ(radius)
// rotateY(-angle), which puts it on the circle while keeping it facing the
// viewer. Turning the ring just changes `turn`, and every card's angle with
// it; because angles are never wrapped back into ±180°, CSS interpolates
// each card smoothly along the arc (no card jumps across the back). The
// radius is a CSS variable (--ring-r), smaller on phones, so this needs no
// window measuring. Reduced-motion visitors get the same positions without
// the travel (the global reduced-motion rule in globals.css).
//
// It also turns by itself every AUTO_TURN_MS — still while hovered — and
// holds after the visitor turns it by hand until their pointer leaves, while
// keyboard focus is inside, off screen or in a background tab. Never for
// reduced-motion visitors unless they press Play.
export function ArtistCarousel({ artists }: { artists: CarouselArtist[] }) {
    // Steps turned so far (any integer). The artist in front is turn mod n.
    const [turn, setTurn] = useState(0)
    const swipeStart = useRef<number | null>(null)
    const regionRef = useRef<HTMLDivElement>(null)
    const count = artists.length
    const active = ((turn % count) + count) % count

    // Set when the visitor turns the ring by hand (every manual control goes
    // through go(); the timer calls setTurn directly). It holds the
    // auto-turn while their pointer is still over the carousel, and is
    // cleared by the tick once the pointer has left — see below.
    const heldByVisitor = useRef(false)

    const go = (delta: number) => {
        heldByVisitor.current = true
        setTurn((t) => t + delta)
    }

    // --- Turning by itself -------------------------------------------------
    // It plays unless the visitor paused it (the button), or prefers reduced
    // motion and hasn't pressed Play. `paused` is null until they choose.
    const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
    const [paused, setPaused] = useState<boolean | null>(null)
    const isPaused = paused ?? reducedMotion
    // It only runs while it's on screen and the browser tab is in front.
    // (It also holds after a manual turn while the pointer stays over it,
    // and while keyboard-focused — checked on each tick below, not tracked
    // as state.)
    const [onScreen, setOnScreen] = useState(false)
    const [tabVisible, setTabVisible] = useState(true)
    const autoTurning = count > 1 && !isPaused && onScreen && tabVisible

    // How the visitor last interacted, anywhere on the page: a key press
    // means focus that follows is keyboard focus; a pointer press means it
    // isn't. Captured at the document so a Tab pressed outside the carousel
    // still counts when focus lands inside it.
    const lastInputWasKeyboard = useRef(false)

    useEffect(() => {
        const onKey = () => (lastInputWasKeyboard.current = true)
        const onPointer = () => (lastInputWasKeyboard.current = false)
        document.addEventListener("keydown", onKey, true)
        document.addEventListener("pointerdown", onPointer, true)
        const onVisibility = () => setTabVisible(document.visibilityState === "visible")
        document.addEventListener("visibilitychange", onVisibility)

        const region = regionRef.current
        const observer =
            region && typeof IntersectionObserver !== "undefined"
                ? new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.4 })
                : null
        if (region) observer?.observe(region)

        return () => {
            observer?.disconnect()
            document.removeEventListener("keydown", onKey, true)
            document.removeEventListener("pointerdown", onPointer, true)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [])

    // A short tick counts time in front. Hovering alone doesn't stop it —
    // the ring keeps turning under the pointer. It's held only when:
    //  - the visitor turned it by hand (heldByVisitor) and the pointer is
    //    still over it (`:hover`, on devices with a real hover; a phone keeps
    //    "hovering" whatever was last tapped, so there the hold ends at the
    //    next tick). Once the pointer has left, the hold is cleared;
    //  - keyboard focus is inside it (the keyboard version of "using it" —
    //    a mouse click on an arrow also focuses it, and doesn't count).
    // Asking each tick avoids enter/leave events, which can be missed when
    // the cards move under the pointer. Being held restarts the count, so
    // it waits a full interval after the visitor lets go — and the effect
    // restarts on every turn, by hand or automatic, so it never moves
    // straight after the visitor chose an artist.
    //
    // Each tick also reports how far through the interval it is, for the
    // filling dot. The value is stored with the turn it belongs to, so a new
    // turn starts at an empty dot without resetting state inside the effect.
    const [progress, setProgress] = useState({ turn: 0, fraction: 0 })
    useEffect(() => {
        if (!autoTurning) return
        let shownFor = 0
        const tick = setInterval(() => {
            const region = regionRef.current
            const hovered = window.matchMedia("(hover: hover)").matches && !!region?.matches(":hover")
            if (heldByVisitor.current && !hovered) heldByVisitor.current = false
            const keyboardFocusInside = lastInputWasKeyboard.current && !!region?.contains(document.activeElement)
            if (heldByVisitor.current || keyboardFocusInside) {
                shownFor = 0
                setProgress({ turn, fraction: 0 })
                return
            }
            shownFor += TICK_MS
            setProgress({ turn, fraction: Math.min(1, shownFor / AUTO_TURN_MS) })
            if (shownFor >= AUTO_TURN_MS) setTurn((t) => t + 1)
        }, TICK_MS)
        return () => clearInterval(tick)
    }, [autoTurning, turn])
    // 0 for a turn that hasn't ticked yet.
    const fraction = progress.turn === turn ? progress.fraction : 0

    if (count === 0) return null

    return (
        <div
            ref={regionRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Our artists"
            className="relative"
            onKeyDown={(e) => {
                if (e.key === "ArrowLeft") go(-1)
                if (e.key === "ArrowRight") go(1)
            }}
        >
            {/* What's in front, for screen readers. Silent while the ring
                turns by itself — an announcement every few seconds would
                drown out everything else; it speaks when paused or turned
                by hand. */}
            <p className="sr-only" aria-live={autoTurning ? "off" : "polite"}>
                {`${artists[active].name}, ${active + 1} of ${count}`}
            </p>

            <div
                // The stage. Its height is fixed, sized for the tallest card
                // (two-line bio, two rows of specialties, a wrapped opening
                // line) with a little room spare. overflow-x-clip stops cards
                // swinging out to the sides from widening the page on a phone.
                // The ring's radius (--ring-r) grows with the screen so the side
                // cards reach towards the section's edges, and the deeper
                // perspective on large screens keeps the far side from
                // shrinking to nothing.
                className="relative h-144 overflow-x-clip [--ring-r:150px] perspective-[1100px] sm:[--ring-r:300px] lg:[--ring-r:400px] lg:perspective-[1400px] xl:[--ring-r:500px]"
                onPointerDown={(e) => {
                    swipeStart.current = e.clientX
                }}
                onPointerUp={(e) => {
                    if (swipeStart.current === null) return
                    const travelled = e.clientX - swipeStart.current
                    swipeStart.current = null
                    if (Math.abs(travelled) >= SWIPE_PX) go(travelled < 0 ? 1 : -1)
                }}
            >
                <div
                    // The tilt puts the cards behind higher; these offsets
                    // keep the ring's top edge near the container's.
                    className="absolute inset-x-0 top-1 bottom-0 origin-top transform-3d sm:top-2 lg:top-0 xl:top-6"
                    // Tilt the ring as if seen from a little above, so cards
                    // behind ride higher and peek over the front one instead
                    // of hiding exactly behind it, then move it back by
                    // exactly where the tilt puts the front card. The ring and
                    // the cards turn about the same point (top centre), so the
                    // front card's transforms cancel out completely: it's drawn
                    // at its real size on whole pixels. Anything less (pushing
                    // back by just the radius, as this once did) leaves it a
                    // fraction of a percent off, and iOS Safari blurs it.
                    style={{
                        transform: `translateY(calc(-${TILT_SIN} * var(--ring-r))) translateZ(calc(-${TILT_COS} * var(--ring-r))) rotateX(${-TILT_DEG}deg)`,
                    }}
                >
                    {artists.map((artist, i) => {
                        // Multiplied before dividing so the front card's angle
                        // is an exact multiple of 360.
                        const angle = ((i - turn) * 360) / count
                        // 1 in front, -1 directly behind.
                        const depth = Math.cos((angle * Math.PI) / 180)
                        const isFront = i === active
                        const nearness = isFront ? 1 : (depth + 1) / 2
                        // Shrinks about the card's centre (its transforms pivot
                        // at its top, to match the ring), so cards behind sit
                        // where they always have.
                        const scale = 0.72 + 0.28 * nearness
                        return (
                            <div
                                key={artist.id}
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${artist.name}, ${i + 1} of ${count}`}
                                aria-hidden={!isFront}
                                inert={!isFront}
                                className="absolute top-0 left-1/2 w-64 -ml-32 origin-top transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.22,0.8,0.3,1)] sm:w-72 sm:-ml-36"
                                style={{
                                    // The last rotateX undoes the ring's tilt, so
                                    // every card still faces the viewer squarely.
                                    transform: `rotateY(${angle}deg) translateZ(var(--ring-r)) rotateY(${-angle}deg) rotateX(${TILT_DEG}deg) translateY(${(1 - scale) * 50}%) scale(${scale})`,
                                    opacity: isFront ? 1 : 0.25 + 0.5 * nearness,
                                    filter: isFront ? "none" : `blur(${(1 - nearness) * 3 + 1}px) saturate(0.7)`,
                                    zIndex: Math.round(depth * 100) + 100,
                                }}
                            >
                                <ArtistSlide artist={artist} />
                            </div>
                        )
                    })}
                </div>

                {/* A side card can be tapped to bring it round to the front.
                    These sit over the left and right thirds, under the arrows. */}
                {count > 1 && (
                    <>
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-hidden
                            onClick={() => go(-1)}
                            className="absolute inset-y-0 left-0 z-250 w-[calc(50%-9rem)] cursor-pointer"
                        />
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-hidden
                            onClick={() => go(1)}
                            className="absolute inset-y-0 right-0 z-250 w-[calc(50%-9rem)] cursor-pointer"
                        />
                    </>
                )}
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        onClick={() => go(-1)}
                        aria-label="Previous artist"
                        className="absolute top-[38%] left-0 z-300 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-foreground shadow-raised transition hover:text-lacquer sm:left-4"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        type="button"
                        onClick={() => go(1)}
                        aria-label="Next artist"
                        className="absolute top-[38%] right-0 z-300 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-foreground shadow-raised transition hover:text-lacquer sm:right-4"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>

                    {/* Where you are on the ring, and the pause control that
                        any self-moving content needs (WCAG 2.2.2). */}
                    <div className="mt-2 flex items-center justify-center gap-3">
                        <div className="flex items-center gap-2" aria-hidden>
                            {artists.map((artist, i) =>
                                i === active ? (
                                    // The current artist's dot. While the ring turns
                                    // itself it fills left to right towards the
                                    // next turn (and empties when held); paused,
                                    // it's solid. The fill eases between the 250 ms
                                    // ticks so it moves continuously.
                                    <span
                                        key={artist.id}
                                        className={`relative h-2 w-8 overflow-hidden rounded-full transition-[width] duration-500 ${autoTurning ? "bg-lacquer/25" : "bg-lacquer"}`}
                                    >
                                        {autoTurning && (
                                            <span
                                                className="absolute inset-y-0 left-0 rounded-full bg-lacquer transition-[width] duration-250 ease-linear"
                                                style={{ width: `${fraction * 100}%` }}
                                            />
                                        )}
                                    </span>
                                ) : (
                                    <span key={artist.id} className="h-2 w-2 rounded-full bg-primary/40 transition-all duration-500" />
                                )
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                // Play means "carry on now": drop any hold left
                                // from turning it by hand earlier (while paused,
                                // the tick that would have released it isn't
                                // running).
                                if (isPaused) heldByVisitor.current = false
                                setPaused(!isPaused)
                            }}
                            aria-label={isPaused ? "Play automatic rotation" : "Pause automatic rotation"}
                            aria-pressed={isPaused}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

// The card: a large round photo that overlaps the top of a smaller
// rectangular card holding the details.
function ArtistSlide({ artist }: { artist: CarouselArtist }) {
    return (
        <div className="flex flex-col items-center">
            <div className="relative z-10 rounded-full bg-surface p-1.5 shadow-raised ring-1 ring-primary/60">
                <CloudinaryImage
                    src={artist.photoUrl}
                    alt={artist.name}
                    sizes="208px"
                    className="h-44 w-44 rounded-full sm:h-52 sm:w-52"
                    fallback={
                        <div className="flex h-44 w-44 items-center justify-center rounded-full bg-muted font-serif text-5xl font-bold text-accent sm:h-52 sm:w-52">
                            {initials(artist.name)}
                        </div>
                    }
                />
            </div>
            {/* -mt pulls the card up under the photo; pt clears it again. */}
            <div className="-mt-20 w-full rounded-xl border border-line bg-surface px-6 pt-24 pb-6 text-center shadow-card">
                <h3 className="font-serif text-2xl font-bold text-surface-foreground">{artist.name}</h3>
                {artist.bio && <p className="mt-1 line-clamp-2 text-base leading-relaxed text-body">{artist.bio}</p>}
                {artist.specialties.length > 0 && (
                    <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Specialties">
                        {artist.specialties.map((specialty) => (
                            <li
                                key={specialty}
                                className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-primary-strong ring-1 ring-primary/40"
                            >
                                {specialty}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground">
                    <CalendarClock className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {artist.nextOpeningLabel}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                    <Link href={`/book?artistId=${artist.id}`} className={buttonVariants({ variant: "gold", className: "w-full" })}>
                        {`Book with ${artist.name.split(" ")[0]}`}
                    </Link>
                    <Link
                        href={`/artists/${artist.id}`}
                        className="inline-flex min-h-11 items-center justify-center font-semibold text-foreground hover:text-lacquer"
                    >
                        See their work
                    </Link>
                </div>
            </div>
        </div>
    )
}
