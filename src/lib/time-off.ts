// Plain module, deliberately NOT inside artist-selector.tsx ('use client') —
// a Server Component importing a non-component named export from a client
// module does not receive the real value across the RSC boundary (confirmed
// live: it came through as an anonymous function, not the string, causing
// the salon-wide comparison in admin/time-off/page.tsx to silently always
// be false). Shared constants that both a Server Component and a Client
// Component need to compare against belong in a plain module like this one.
export const SALON_WIDE_VALUE = "__salon-wide__"
