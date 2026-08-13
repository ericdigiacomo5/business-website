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

export const { handlers, auth, signIn, signOut } = NextAuth({
  // IMPORTANT: pass our own singleton, never `import { PrismaClient } from "@prisma/client"`
  // directly — that import path is broken in this project because schema.prisma uses a
  // custom generator `output`, and no node_modules/.prisma compatibility shim gets written.
  adapter: PrismaAdapter(prisma),

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
  session: { strategy: "jwt" },

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
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    // Reads back off `token`, not `user` — under JWT strategy there's no
    // database row to fetch a fresh AdapterUser from on every request, unlike
    // the "database" strategy shape this started out as.
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
})
