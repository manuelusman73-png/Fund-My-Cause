# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅ Yes    |
| < 0.1   | ❌ No     |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/Fund-My-Cause/Fund-My-Cause/security/advisories/new). This ensures the issue is handled confidentially before any public disclosure.

Include in your report:
- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Affected component (smart contract, frontend, CI/CD)
- Potential impact assessment

## Response Timeline

| Milestone | Target |
| --------- | ------ |
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 30 days (critical: 7 days) |
| Public disclosure | After fix is deployed |

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure). We will credit reporters in the release notes unless anonymity is requested.

## Out-of-Scope Items

The following are **not** considered vulnerabilities for this project:

- Issues in third-party dependencies already tracked by `npm audit` or `cargo audit`
- Theoretical attacks with no practical exploit path
- Denial-of-service via excessive on-chain transactions (Stellar network rate limits apply)
- Social engineering or phishing attacks targeting end users
- Vulnerabilities in Stellar/Soroban core infrastructure (report those to [Stellar's bug bounty](https://www.stellar.org/bug-bounty-program))
- Issues only reproducible on unsupported versions

## Bug Bounty

This project does not currently operate a paid bug bounty program. We do publicly acknowledge security researchers who responsibly disclose valid vulnerabilities in our release notes and CHANGELOG.

## Scope

| Component | In Scope |
| --------- | -------- |
| `contracts/crowdfund` Soroban smart contract | ✅ |
| `contracts/registry` Soroban smart contract | ✅ |
| `apps/interface` Next.js frontend | ✅ |
| GitHub Actions CI/CD workflows | ✅ |
| Stellar / Soroban core protocol | ❌ (report to Stellar) |
