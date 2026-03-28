# Fund-My-Cause

A decentralized crowdfunding platform built on the [Stellar](https://stellar.org) network using [Soroban](https://soroban.stellar.org) smart contracts. Fund-My-Cause lets anyone create a campaign on-chain, accept contributions in XLM or any Stellar token, and automatically release or refund funds based on whether the goal is met.

[![CI Status](https://github.com/Fund-My-Cause/Fund-My-Cause/workflows/Rust%20CI/badge.svg)](https://github.com/Fund-My-Cause/Fund-My-Cause/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Contract Version](https://img.shields.io/badge/contract-v0.1.0-brightgreen)](./contracts/crowdfund/Cargo.toml)
![Coverage](https://img.shields.io/badge/coverage-80%25-green)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (TypeScript)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Navbar     │  │ ProgressBar  │  │  PledgeModal         │  │
│  │ (Freighter)  │  │ (Campaign)   │  │  (Contribution)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                    WalletContext                                │
│                  (Freighter API)                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ (sign transactions)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Stellar RPC Endpoint                         │
│              (Testnet: https://soroban-testnet.stellar.org)     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ (invoke contracts)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Soroban Smart Contracts                       │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Crowdfund Contract  │  │  Registry Contract               │ │
│  │  - initialize()      │  │  - register(campaign_id)         │ │
│  │  - contribute()      │  │  - list_campaigns()              │ │
│  │  - withdraw()        │  │  - get_campaign_count()          │ │
│  │  - refund_single()   │  │                                  │ │
│  │  - get_stats()       │  │                                  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ (store state)
                            ▼
                    Stellar Ledger
```

---

## How It Works

1. A creator deploys and initializes a campaign with a funding goal, deadline, and minimum contribution.
2. Contributors pledge tokens before the deadline.
3. If the goal is met by the deadline, the creator withdraws the funds (minus an optional platform fee).
4. If the goal is not met, each contributor individually claims their refund via a pull-based model.

---

## Monorepo Structure

```
Fund-My-Cause/
├── apps/
│   └── interface/          # Next.js 16 frontend (TypeScript + Tailwind)
│       ├── src/
│       │   ├── app/        # Next.js App Router pages & layouts
│       │   ├── components/ # UI components (Navbar, ProgressBar, PledgeModal, etc.)
│       │   ├── context/    # WalletContext (Freighter wallet integration)
│       │   ├── lib/        # Soroban contract client helpers
│       │   └── types/      # Shared TypeScript types
│       └── package.json
├── contracts/
│   └── crowdfund/          # Soroban smart contract (Rust)
│       ├── src/
│       │   └── lib.rs      # Core contract logic
│       └── Cargo.toml
│   └── registry/           # Soroban registry contract for campaign discovery
│       ├── src/
│       │   └── lib.rs      # register/list campaign contract IDs
│       └── Cargo.toml
├── scripts/
│   └── deploy.sh           # Automated deploy + initialize script
├── .github/
│   └── workflows/
│       └── rust_ci.yml     # CI: build WASM + run tests
├── Cargo.toml              # Rust workspace config
├── package.json            # Node workspace config
└── README.md
```

---

## Smart Contract

The Soroban contract lives in `contracts/crowdfund/src/lib.rs` and exposes the following interface:

| Function                                                                                                          | Description                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `initialize(creator, token, goal, deadline, min_contribution, title, description, social_links, platform_config)` | Create a new campaign                                                         |
| `contribute(contributor, amount)`                                                                                 | Pledge tokens before the deadline                                             |
| `update_metadata(title, description, social_links)`                                                               | Update campaign metadata if status is Active                                  |
| `withdraw()`                                                                                                      | Creator claims funds after a successful campaign                              |
| `refund_single(contributor)`                                                                                      | Contributor claims their own refund if goal not met                           |
| `get_stats()`                                                                                                     | Returns `CampaignStats` (total raised, progress bps, contributor count, etc.) |
| `total_raised()`                                                                                                  | Current total raised                                                          |
| `goal()`                                                                                                          | Campaign funding goal                                                         |
| `deadline()`                                                                                                      | Campaign deadline (ledger timestamp)                                          |
| `contribution(contributor)`                                                                                       | Contribution amount for a specific address                                    |
| `min_contribution()`                                                                                              | Minimum allowed contribution                                                  |
| `title()` / `description()`                                                                                       | Campaign metadata                                                             |
| `social_links()`                                                                                                  | Campaign social URLs                                                          |
| `version()`                                                                                                       | Contract version number                                                       |

### Pull-based Refund Model

Rather than a single transaction refunding all contributors (which would fail at scale), each contributor calls `refund_single` to claim their own refund. This is gas-efficient, scalable, and avoids a single point of failure.

### Platform Fee

An optional `PlatformConfig` can be set at initialization with a fee in basis points (e.g. `250` = 2.5%). The fee is deducted from the creator's payout on withdrawal and sent to the platform address.

---

## Frontend

The interface is a Next.js 16 app using the App Router, Tailwind CSS v4, and Freighter wallet integration.

Key components:

- `Navbar` — wallet connect/disconnect via Freighter
- `ProgressBar` — visual funding progress
- `CountdownTimer` — live countdown to campaign deadline
- `PledgeModal` — contribution flow with wallet auth

### Wallet Integration

The app uses `@stellar/freighter-api` for wallet connectivity. The `WalletContext` provider wraps the app and exposes `connect`, `disconnect`, `address`, and `signTx`.

---

## Prerequisites

### Contracts

| Requirement | Version | Installation |
|---|---|---|
| Rust | 1.70+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | - | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | 21.0+ | [Installation Guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |

### Frontend

| Requirement | Version | Installation |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Included with Node.js |
| Freighter | Latest | [freighter.app](https://www.freighter.app/) |

### Optional

- Docker (for containerized deployment)
- GitHub CLI (for release automation)

---

## Getting Started

### 1. Clone

```bash
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause
```

### 2. Build & test the contract

```bash
# Build WASM
cargo build --release --target wasm32-unknown-unknown

# Run tests
cargo test --workspace
```

### 3. Deploy to testnet

```bash
DEADLINE=$(date -d "+30 days" +%s)
./scripts/deploy.sh <CREATOR_ADDRESS> <TOKEN_ADDRESS> 1000 $DEADLINE 10 "My Campaign" "A great cause" null [REGISTRY_CONTRACT_ID]
```

If `REGISTRY_CONTRACT_ID` is omitted, the script deploys a new registry contract.
After campaign initialization, the script calls `registry.register(campaign_id)` automatically.

Save the printed `Contract ID` and `Registry ID` — you'll need them in frontend config.

### 4. Configure frontend environment

Create `apps/interface/.env.local`:

```bash
NEXT_PUBLIC_CROWDFUND_CONTRACT_ID=<CONTRACT_ID>
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<REGISTRY_ID>
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### 5. Run the frontend

```bash
cd apps/interface
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables Reference

### Frontend (`apps/interface/.env.local`)

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_CROWDFUND_CONTRACT_ID` | Yes | Deployed crowdfund contract ID | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Yes | Deployed registry contract ID | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Yes | Stellar RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Yes | Stellar network identifier | `Test SDF Network ; September 2015` |

### Deployment (`scripts/deploy.sh`)

| Parameter | Description | Example |
|---|---|---|
| `CREATOR_ADDRESS` | Campaign creator's Stellar address | `GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQSTBE2EURIDVXL6B` |
| `TOKEN_ADDRESS` | Token contract address (XLM or custom) | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` |
| `GOAL` | Funding goal in stroops | `1000000000` |
| `DEADLINE` | Unix timestamp for campaign end | `1704067200` |
| `MIN_CONTRIBUTION` | Minimum contribution in stroops | `1000000` |

---

## Troubleshooting

### Freighter Not Found

**Problem:** "Freighter extension not detected"

**Solution:**
1. Install [Freighter](https://www.freighter.app/) for your browser
2. Ensure it's enabled in browser extensions
3. Refresh the page
4. Check browser console for errors: `F12` → Console tab

### RPC Connection Errors

**Problem:** "Failed to connect to Soroban RPC"

**Solution:**
1. Verify `NEXT_PUBLIC_SOROBAN_RPC_URL` is correct in `.env.local`
2. Check network connectivity: `curl https://soroban-testnet.stellar.org`
3. Ensure you're on Stellar Testnet (not Mainnet)
4. Try switching networks in Freighter settings

### Contract Not Found

**Problem:** "Contract not found on ledger"

**Solution:**
1. Verify contract ID is correct: `stellar contract info --id <CONTRACT_ID>`
2. Ensure contract is deployed to the correct network (Testnet)
3. Check contract hasn't expired (Soroban contracts have TTL)
4. Redeploy if necessary: `./scripts/deploy.sh ...`

### Build Failures

**Problem:** `error: failed to compile`

**Solution:**
1. Update Rust: `rustup update`
2. Add wasm32 target: `rustup target add wasm32-unknown-unknown`
3. Clear build cache: `cargo clean && cargo build --release --target wasm32-unknown-unknown`
4. Check Stellar CLI version: `stellar version` (should be 21.0+)

### Transaction Signing Fails

**Problem:** "User rejected transaction" or wallet doesn't respond

**Solution:**
1. Ensure Freighter is unlocked
2. Check you're on the correct network in Freighter
3. Verify account has sufficient XLM for fees (~0.00001 XLM per operation)
4. Try disconnecting and reconnecting wallet in Navbar

---

## CI/CD

GitHub Actions runs on every push/PR to `main`:

- Builds the WASM binary
- Runs all Rust unit tests

See `.github/workflows/rust_ci.yml`.

---

## Code Coverage

The frontend enforces a minimum **80% coverage threshold** across all metrics (statements, branches, functions, lines) via Jest. The build fails if any metric drops below this floor.

Run coverage locally:

```bash
cd apps/interface
npm run test:coverage
```

Thresholds are configured in `apps/interface/jest.config.js` under `coverageThreshold.global`.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `git commit -m "feat: add X"`
4. Open a pull request

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Reproducible Builds & Cargo.lock

`Cargo.lock` is **committed to this repository** intentionally.

For application binaries and smart contracts, locking every transitive dependency to an exact version is a security requirement — not optional. Without it:

- A `cargo build` on a different machine or at a later date may silently pull in a newer (potentially compromised or breaking) version of any dependency.
- Audits and vulnerability scans target specific versions; a floating lock file makes those results meaningless.
- Soroban WASM bytecode must be byte-for-byte reproducible so that on-chain contract hashes can be independently verified.

This follows the [Cargo book's recommendation](https://doc.rust-lang.org/cargo/faq.html#why-do-binaries-have-cargolock-in-version-control-but-not-libraries) for binaries and aligns with Rust smart contract best practices.

---

## Built on Stellar

Fund-My-Cause is powered by the Stellar network and Soroban smart contracts. Stellar provides fast, low-cost transactions with 5-second finality, making it ideal for crowdfunding at scale.

- [Stellar Docs](https://developers.stellar.org)
- [Soroban Docs](https://soroban.stellar.org)
- [Freighter Wallet](https://www.freighter.app)
