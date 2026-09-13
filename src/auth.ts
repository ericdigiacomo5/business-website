import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Precomputed once so authorize() always runs a bcrypt.compare of roughly the
// same cost, whether or not the account exists — without this, a nonexistent
// email returns near-instantly (no compare at all) while a real email with a
// wrong password takes bcrypt's deliberately-slow compare time, letting an
// attacker enumerate valid emails purely by timing. Cost factor (10) should
// match whatever the registration route ends up hashing new passwords with.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("no-such-user-timing-safety", 10)

const prismaAdapter = PrismaAdapter(prisma)

export const { handlers, auth, signIn, signOut } = NextAuth({
  // IMPORTANT: pass our own singleton, never `import { PrismaClient } from "@prisma/client"`
  // directly — that import path is broken in this project because schema.prisma uses a
  // custom generator `output`, and no node_modules/.prisma compatibility shim gets written.
  adapter: {
    ...prismaAdapter,
    // User.phone is required, but the adapter's own createUser (used for
    // first-time OAuth sign-in, e.g. Google) has no phone to supply — it
    // only ever gets name/email/image/emailVerified from the provider
    // profile. Same placeholder sentinel as the migration's backfill for
    // pre-existing rows, so it's recognizable everywhere as "needs a real
    // value," not a coincidentally-blank field. A future profile-edit
    // feature can prompt the user to replace it; not built yet.
    createUser: (data) =>
      prismaAdapter.createUser!({ ...data, phone: "UNKNOWN" } as typeof data & { phone: string }),
  },

  // JWT, not database, despite having an adapter configured. Originally tried
  // "database" for revocable sessions, but confirmed (via a real sign-in
  // against a running server, then checking the DB) that Credentials sign-ins
  // are a hard exception: Auth.js's own callback handler always JWT-encodes
  // the cookie for the "credentials" provider type, regardless of this
  // setting — while session *reads* branch on this setting globally, with no
  // per-provider awareness. Under "database", that mismatch meant a
  // Credentials sign-in's cookie could never be read back — the very next
  // request saw the user as signed out, and the server actively cleared the
  // cookie. "jwt" makes both providers behave consistently (correctly) at the
  // cost of losing server-side revocability for Google sign-ins too, which
  // previously worked correctly under "database" — see PROJECT_STATUS.md.
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
        if (!credentials.email || typeof credentials.email !== "string") {
          return null
        }

        if (!credentials.password || typeof credentials.password !== "string") {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
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
    // Google, like every provider, auto-infers AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET
    // from its provider id ("google") — no explicit clientId/clientSecret
    // needed here. Real values are in .env (from a Google Cloud Console OAuth
    // client, Web application type).
    Google,
  ],

  callbacks: {
    // Runs at sign-in (`user` defined — this is what authorize() or the OAuth
    // profile callback returned) AND again on every subsequent request (`user`
    // undefined then, since there's no adapter lookup under JWT strategy — the
    // token itself is the only source of truth). Only copy from `user` when
    // it's actually there; otherwise leave whatever's already encoded in the
    // token from the original sign-in untouched.
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
      if (user?.id) {
        token.id = user.id
        token.role = user.role
        return token
      }

      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true, role: true },
        })

        // Returning null tells Auth.js to clear the session cookie, so a
        // deleted account can't keep using an already-signed token.
        if (!fresh) return null

        token.name = fresh.name
        token.email = fresh.email
        token.role = fresh.role
      }

      return token
    },
    // Reads back off `token`, not `user` — under JWT strategy there's no
    // database row to fetch a fresh AdapterUser from on every request, unlike
    // the "database" strategy shape this started out as.
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      if (token.name) session.user.name = token.name
      if (token.email) session.user.email = token.email
      return session
    },
  },
})
