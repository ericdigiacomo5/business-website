import type { NextConfig } from "next";

// Next ships none of these by default, and this project has no proxy.ts /
// middleware.ts to set them in, so they're configured here.
//
// Deliberately omitted for now:
// - Strict-Transport-Security: only meaningful once the app is served over
//   HTTPS end-to-end. Add it during the Cloudflare Workers deploy, not before
//   — setting it against a local http:// dev server does nothing, and a
//   too-early max-age on a domain that isn't fully HTTPS can lock users out.
// - A strict script-src: Next's App Router injects inline hydration scripts,
//   so a nonce-based policy requires wiring through a proxy — which this
//   project deliberately avoids. The directives below are the high-value
//   subset that doesn't need one.
// React's development build uses eval() for debugging features (rebuilding
// callstacks across environments); production never does. Without this the
// dev console fills with CSP eval violations. Scoped to dev only so the
// production policy stays strict — 'unsafe-eval' in production would defeat
// much of the point of having a CSP at all.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  // Clickjacking. The concrete risk here is the admin dashboard's
  // status-change buttons being framed and click-hijacked.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is required by Next's hydration bootstrap; see the
      // nonce note above for why a stricter policy is deferred rather than
      // just tightened here.
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      // https: and data: because the artist/portfolio image host isn't
      // chosen yet (Cloudinary vs S3). Narrow this to the real host once it
      // is — that's the point at which imageUrl becomes user-influenced.
      "img-src 'self' https: data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
