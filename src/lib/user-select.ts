// The single allowlist of User fields that may leave the server, imported by
// every query that reads User — API routes AND Server Components alike.
//
// This exists because the "use an explicit select" rule previously lived only
// in per-file comments, and a Server Component page (admin/page.tsx) used a
// bare `include: { user: true }` instead. Prisma returns every scalar by
// default, so that shipped passwordHash into the browser's RSC payload for
// every customer with a booking. Importing one constant makes the rule
// enforceable rather than remembered.
//
// Never add passwordHash, emailVerified, or image here. If a caller needs
// fewer fields than this, narrow at that call site; never widen this.
export const SAFE_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
} as const

// For relation includes where role isn't needed (e.g. rendering a booking's
// customer). Narrower than SAFE_USER_SELECT on purpose.
export const SAFE_USER_SELECT_BASIC = {
    id: true,
    name: true,
    email: true,
    phone: true,
} as const
