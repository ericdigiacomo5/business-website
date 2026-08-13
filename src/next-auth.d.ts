import type { Role } from "@/generated/prisma/client"

// Augments Auth.js's built-in User/Session types with our own custom `role`
// field. Augmenting `User` here is enough — `AdapterUser` extends `User`, and
// `Session.user` is typed as `User`, so both pick up `role` through the same
// declaration merge. Still needed even under JWT strategy: `user` is what
// authorize()/the OAuth profile callback returns on sign-in, before it's
// copied into the token by the `jwt` callback in auth.ts.
declare module "@auth/core/types" {
  interface User {
    role: Role
  }
}

// Under `session.strategy: "jwt"`, custom fields have to round-trip through
// the JWT itself (auth.ts's `jwt` callback writes `id`/`role` onto `token` at
// sign-in; the `session` callback reads them back off `token`, not `user`, on
// every later request). `JWT` already extends Record<string, unknown>, so
// `token.role = user.role` type-checks without this — but reading it back out
// would come back as `unknown` without an explicit type here.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    role: Role
  }
}
