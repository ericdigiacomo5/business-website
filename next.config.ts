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
      // Artist/portfolio images only ever come from the signed Cloudinary
      // upload (the API rejects any other URL), and they're served through
      // next/image's /_next/image endpoint ('self'). res.cloudinary.com is
      // allowed directly too, so an unoptimized image still loads.
      "img-src 'self' https://res.cloudinary.com data:",
      "font-src 'self' data:",
      // Cloudinary is now the chosen image host — the admin photo-upload
      // component fetches directly to Cloudinary's upload API from the
      // browser (see photo-upload-field.tsx), which is a cross-origin
      // connect-src, not just an img-src load. Scoped to Cloudinary's own
      // domain specifically, not a wildcard.
      "connect-src 'self' https://api.cloudinary.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// next/image may only fetch and resize images from the salon's own
// Cloudinary account (scoped to its cloud name when that's configured), the
// same rule isCloudinaryUrl() applies on the way in.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: cloudName ? `/${cloudName}/**` : "/**",
      },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must never be served stale from the HTTP cache,
      // or a fixed bug in it could stay installed on phones indefinitely.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
