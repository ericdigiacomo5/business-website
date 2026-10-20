import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { BCRYPT_COST } from "@/lib/password"
import { normalizeEmail, UNKNOWN_PHONE } from "@/lib/validation"

// Compared against when an account doesn't exist, so authorize() always runs
// one bcrypt.compare of the same cost — without this, a nonexistent email
// returns near-instantly while a real email with a wrong password takes
// bcrypt's deliberately-slow compare time, letting an attacker enumerate
// valid emails purely by timing. A precomputed hash of a random string
// nobody knows (not hashSync at startup: on Cloudflare Workers that would
// spend bcrypt's CPU time on every cold start). Its cost must match
// BCRYPT_COST, or the timing reasoning breaks — the check below fails loudly
// if they drift apart.
const DUMMY_PASSWORD_HASH = "$2b$10$duWU74THNTZm36HrP2HhDueSiNwv2Go7vZOUVWwVzUWd12M.o/4b."
if (bcrypt.getRounds(DUMMY_PASSWORD_HASH) !== BCRYPT_COST) {
  throw new Error("DUMMY_PASSWORD_HASH must use BCRYPT_COST — regenerate it with bcrypt.hashSync(<random>, BCRYPT_COST)")
}

// Absolute session lifetimes. The 8-hour maxAge below slides — Auth.js
// re-issues the token on every session read, so a token in regular use
// never expires on its own. These cap how long one sign-in lasts no matter
// how active it is, timed from authTime (stamped once, at sign-in).
const ABSOLUTE_SESSION_SECONDS = {
  ADMIN: 12 * 60 * 60, // one long shift
  CUSTOMER: 14 * 24 * 60 * 60,
} as const

// Email and password is the only way to sign in. Google sign-in was
// configured until 2026-10-19 but never offered in the UI, so it was
// removed (with the Auth.js database adapter it needed) rather than shipped
// untested. No adapter: Credentials sign-in never uses one.
export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT sessions. "database" sessions can't work with Credentials: Auth.js
  // always JWT-encodes the cookie for the "credentials" provider type, while
  // session *reads* follow this setting — confirmed against a running server
  // when this project briefly tried "database", where every Credentials
  // sign-in was signed out on its next request. The jwt callback below
  // re-reads the user on every request to get revocation back.
  // maxAge bounds how long a stolen or no-longer-authorized token stays
  // usable. JWTs can't be revoked server-side (no Session row to delete under
  // this strategy), so the expiry is the only backstop — Auth.js's 30-day
  // default is too long for an app with an admin surface. 8 hours ≈ one shift.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        // Same canonical form registration stores, so "Jane@x.com" signs in
        // to the account registered as "jane@x.com".
        const email = normalizeEmail(credentials.email)
        if (!email) {
          return null
        }

        if (!credentials.password || typeof credentials.password !== "string") {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email }
        })

        // Always compare, even when there's no user/passwordHash to check
        // against — falling back to DUMMY_PASSWORD_HASH keeps this call's cost
        // constant regardless of whether the account exists, so the reject
        // path below doesn't leak that information through response timing.
        const isMatch = await bcrypt.compare(
          credentials.password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH
        )

        if (!user || !user.passwordHash || !isMatch) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    // Runs at sign-in (`user` defined — this is what authorize() returned)
    // AND again on every subsequent request (`user` undefined then — under
    // JWT strategy the token itself is the only source of truth). Only copy
    // from `user` when it's actually there; otherwise leave whatever's
    // already encoded in the token from the original sign-in untouched.
    //
    // On every later request the User row is re-read, for two reasons:
    //
    // 1. Revocation. token.role used to be written only at sign-in, so
    //    demoting an admin in the database had no effect on their active
    //    session — they kept ADMIN until the token expired. Re-reading makes
    //    a role change (and a deleted account) take effect immediately.
    //
    // 2. Integrity. The `session` argument of this callback is the raw
    //    request body of a client's useSession().update() call — entirely
    //    attacker-controlled. Writing it into the token let any signed-in
    //    user mint a validly-signed JWT carrying someone else's email.
    //    The trigger is now treated as a signal that something changed, and
    //    the values come from the database instead of from the caller.
    //
    // The cost is one indexed lookup per request, which is small next to the
    // Prisma work these routes already do — and is what buys revocability
    // back after the strategy switch documented above.
    async jwt({ token, user }) {
      // At sign-in, record who this is, then fall through to the same fresh
      // read every later request does — so profileIncomplete is correct
      // from the first page load, not just from the second.
      if (user?.id) {
        token.id = user.id
        token.role = user.role
        // When this sign-in happened, for the absolute lifetime below. Not
        // `iat`: Auth.js re-stamps iat every time it re-issues the token.
        token.authTime = Math.floor(Date.now() / 1000)
      }

      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            name: true,
            email: true,
            emailVerified: true,
            phone: true,
            role: true,
            passwordChangedAt: true,
            sessionsRevokedAt: true,
          },
        })

        // Returning null tells Auth.js to clear the session cookie, so a
        // deleted account can't keep using an already-signed token.
        if (!fresh) return null

        // A password reset or "Sign out of all devices" can't delete this
        // token the way a database session could (JWT strategy has no
        // server-side row to revoke) — this is the substitute. A token last
        // issued before either is treated the same as a deleted account:
        // signed out on its very next request. (Every token in use is
        // re-issued with a fresh iat, so "issued before" means "this
        // session existed before the revocation".)
        const revokedAt = Math.max(
          fresh.passwordChangedAt?.getTime() ?? 0,
          fresh.sessionsRevokedAt?.getTime() ?? 0,
        )
        if (token.iat && token.iat * 1000 < revokedAt) {
          return null
        }

        // A sign-in lasts at most ABSOLUTE_SESSION_SECONDS, however active.
        // Tokens from before authTime existed have none and are signed out
        // once.
        const maxSeconds = ABSOLUTE_SESSION_SECONDS[fresh.role]
        if (!token.authTime || Date.now() / 1000 - token.authTime > maxSeconds) {
          return null
        }

        token.name = fresh.name
        token.email = fresh.email
        token.role = fresh.role
        // Missing name or the placeholder phone (both only on accounts older
        // than those required fields). Drives the "complete your profile"
        // banner and blocks customer self-booking until fixed. Re-evaluated
        // on every request, so it clears the moment the profile is saved.
        token.profileIncomplete = !fresh.name || fresh.phone === UNKNOWN_PHONE
        // A self-registered account whose address isn't confirmed yet. Same
        // treatment: banner, and no customer self-booking until fixed.
        token.emailUnverified = !fresh.emailVerified
      }

      return token
    },
    // Reads back off `token`, not `user` — under JWT strategy the token is
    // what the jwt callback above just refreshed from the database.
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      if (token.name) session.user.name = token.name
      if (token.email) session.user.email = token.email
      session.user.profileIncomplete = token.profileIncomplete ?? false
      session.user.emailUnverified = token.emailUnverified ?? false
      return session
    },
  },
})
