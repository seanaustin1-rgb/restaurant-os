/** @type {import('next').NextConfig} */

// Baseline security headers on every response. Deliberately conservative: no
// Content-Security-Policy yet — Clerk, Plaid Link and inline scripts need a
// tuned policy, so CSP ships separately in Report-Only mode first
// (docs/security/SECURITY-REVIEW-2026-10-20.md, item H-2).
const securityHeaders = [
  // Force HTTPS for two years, including subdomains. (No "preload" — that is a
  // separate, hard-to-undo commitment to the browser preload list.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // No MIME sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry day codes / ids) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app is never meant to be framed (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Camera stays available to this origin only (future photo → bottle card);
  // everything else off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    outputFileTracingIncludes: {
      "/vault": ["./docs/spirit-vault/**"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
