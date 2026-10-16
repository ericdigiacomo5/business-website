'use client' // Error boundaries must be Client Components

// Last-resort error page for an error in the root layout itself (e.g. the
// session lookup in layout.tsx failing), where app/error.tsx can't help
// because it renders *inside* that layout. It replaces the whole document,
// so the site's CSS and fonts aren't available — styles are inline, using
// the same colors as globals.css.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f6ead9",
                    color: "#16212c",
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                    textAlign: "center",
                    padding: 24,
                }}
            >
                <title>Something went wrong — Nail Image Inc.</title>
                <main style={{ maxWidth: "26rem" }}>
                    <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.9rem", margin: "0 0 8px" }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: "#5f6f7d", lineHeight: 1.5, margin: "0 0 24px" }}>
                        The site couldn&apos;t load. Please try again — if it keeps happening, contact the salon
                        directly.
                    </p>
                    <button
                        onClick={() => retry()}
                        style={{
                            minHeight: 44,
                            padding: "0 24px",
                            background: "#2f6f9e",
                            color: "#ffffff",
                            border: "1px solid #16212c",
                            borderRadius: 2,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            cursor: "pointer",
                        }}
                    >
                        Try Again
                    </button>
                </main>
            </body>
        </html>
    )
}
