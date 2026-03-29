import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy directives.
 *
 * default-src 'self'          — baseline: only same-origin resources allowed
 * script-src  'self' + eval  — 'unsafe-eval' is required by Next.js HMR in dev;
 *                               removed in production for a tighter policy
 * style-src   'self' 'unsafe-inline' — Tailwind injects inline styles at runtime
 * connect-src 'self' + RPC   — Soroban RPC, Horizon, and CoinGecko price feed
 * img-src     'self' data:   — data URIs for inline images; Unsplash & IPFS for
 *                               campaign cover images
 * font-src    'self'          — self-hosted fonts only
 * frame-ancestors 'none'     — prevents clickjacking via iframes
 * object-src  'none'          — disables Flash / legacy plugin embeds
 */
const cspDirectives = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-eval'"
    : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  [
    "connect-src 'self'",
    "https://soroban-testnet.stellar.org",
    "https://horizon-testnet.stellar.org",
    "https://api.coingecko.com",
  ].join(" "),
  "img-src 'self' data: https://images.unsplash.com https://ipfs.io",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
    ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
