# Dependency Audit Notes

## Known Vulnerabilities (cannot be auto-fixed)

### `next` 16.1.6 — moderate severity

| Advisory | Description |
|---|---|
| [GHSA-ggv3-7p47-pfv8](https://github.com/advisories/GHSA-ggv3-7p47-pfv8) | HTTP request smuggling in rewrites |
| [GHSA-3x4c-7xq6-9pq8](https://github.com/advisories/GHSA-3x4c-7xq6-9pq8) | Unbounded next/image disk cache growth |
| [GHSA-h27x-g6w4-24gq](https://github.com/advisories/GHSA-h27x-g6w4-24gq) | Unbounded postponed resume buffering (DoS) |
| [GHSA-mq59-m269-xvcx](https://github.com/advisories/GHSA-mq59-m269-xvcx) | null origin bypasses Server Actions CSRF |
| [GHSA-jcc7-9wpm-mj36](https://github.com/advisories/GHSA-jcc7-9wpm-mj36) | null origin bypasses dev HMR CSRF |

**Why not fixed:** `npm audit fix --force` would install `next@16.2.1`, which is outside the
`16.x` range pinned by `eslint-config-next`. Upgrading requires coordinated testing of the
full build pipeline. Tracked in issue #136 for the next release cycle.

**Mitigations in place:**
- CSP headers (see `next.config.ts`) limit the blast radius of CSRF-style attacks.
- The app does not use Next.js rewrites, reducing exposure to the smuggling advisory.
- Deployment is on Stellar testnet only; no production traffic at this time.

### `brace-expansion` — moderate severity

| Advisory | Description |
|---|---|
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | Zero-step sequence causes process hang |

**Why not fixed:** Transitive dependency of `@typescript-eslint`. Only reachable during
local development/CI lint runs, not in the production bundle. Risk is negligible.
