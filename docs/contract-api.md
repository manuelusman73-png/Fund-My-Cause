# Fund-My-Cause Contract API Reference

Complete reference for the Soroban smart contract powering Fund-My-Cause crowdfunding platform.

## Overview

The contract manages decentralized crowdfunding campaigns on the Stellar network. Campaigns accept contributions in XLM or any Stellar token, with automatic fund release or refund based on goal achievement.

**Contract Version:** 3

---

## Data Types

### Status

Campaign lifecycle state.

```rust
pub enum Status {
    Active,      // Campaign accepting contributions
    Successful,  // Goal reached, funds withdrawn
    Refunded,    // Goal not met, contributors refunded
    Cancelled,   // Creator cancelled campaign
    Paused,      // Temporarily paused (admin only)
}
```

### CampaignStats

Live campaign statistics.

```rust
pub struct CampaignStats {
    pub total_raised: i128,           // Total raised in stroops (1 XLM = 10,000,000 stroops)
    pub goal: i128,                   // Funding goal in stroops
    pub progress_bps: u32,            // Progress in basis points (0-10000, where 10000 = 100%)
    pub contributor_count: u32,       // Number of unique contributors
    pub average_contribution: i128,   // Average contribution per contributor in stroops
    pub largest_contribution: i128,   // Largest single contribution in stroops
}
```

### CampaignInfo

Complete campaign metadata and state.

```rust
pub struct CampaignInfo {
    pub creator: Address,             // Campaign creator's Stellar address
    pub token: Address,               // Primary token address (usually XLM)
    pub goal: i128,                   // Funding goal in stroops
    pub deadline: u64,                // Unix timestamp (seconds) when campaign ends
    pub min_contribution: i128,       // Minimum contribution in stroops
    pub title: String,                // Campaign title (max 100 chars recommended)
    pub description: String,          // Campaign description (max 1000 chars recommended)
    pub status: Status,               // Current campaign status
    pub has_platform_config: bool,    // Whether platform fee is configured
    pub platform_fee_bps: u32,        // Platform fee in basis points (0-10000)
    pub platform_address: Address,    // Address receiving platform fees
}
```

### PlatformConfig

Optional platform fee configuration.

```rust
pub struct PlatformConfig {
    pub address: Address,             // Address to receive fees
    pub fee_bps: u32,                 // Fee in basis points (0-10000, where 10000 = 100%)
}
```

### DataKey

Storage key variants for persistent and instance storage.

```rust
pub enum DataKey {
    Contribution(Address),            // Persistent: individual contribution amount
    ContributorPresence(Address),     // Persistent: whether address has contributed
    ContributorCount,                 // Instance: total unique contributors
    LargestContribution,              // Instance: largest single contribution
    AcceptedTokens,                   // Instance: whitelist of accepted token addresses
}
```

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1 | `AlreadyInitialized` | Contract already initialized (can only initialize once) |
| 2 | `CampaignEnded` | Campaign deadline has passed |
| 3 | `CampaignStillActive` | Campaign is still active (deadline not reached) |
| 4 | `GoalNotReached` | Funding goal not met (cannot withdraw) |
| 5 | `GoalReached` | Funding goal already reached (cannot refund) |
| 6 | `Overflow` | Arithmetic overflow in amount calculation |
| 7 | `NotActive` | Campaign is not in Active status |
| 8 | `InvalidFee` | Platform fee exceeds 10000 basis points |
| 9 | `BelowMinimum` | Contribution below minimum or invalid amount |
| 10 | `InvalidDeadline` | Deadline is in the past or invalid |
| 11 | `CampaignPaused` | Campaign is paused (admin action) |
| 12 | `InvalidGoal` | Goal must be positive |
| 13 | `TokenNotAccepted` | Token not in accepted tokens whitelist |

---

## State-Changing Functions

### initialize

Initialize a new campaign. **Can only be called once per contract.**

**Signature:**
```rust
pub fn initialize(
    env: Env,
    creator: Address,
    token: Address,
    goal: i128,
    deadline: u64,
    min_contribution: i128,
    title: String,
    description: String,
    social_links: Option<Vec<String>>,
    platform_config: Option<PlatformConfig>,
    accepted_tokens: Option<Vec<Address>>,
) -> Result<(), ContractError>
```

**Parameters:**
- `creator` — Campaign creator's Stellar address (must authorize)
- `token` — Primary token address (usually XLM contract)
- `goal` — Funding goal in stroops (must be > 0)
- `deadline` — Unix timestamp when campaign ends (must be > current time)
- `min_contribution` — Minimum contribution in stroops (must be ≥ 0)
- `title` — Campaign title
- `description` — Campaign description
- `social_links` — Optional array of social media URLs or image CIDs
- `platform_config` — Optional fee configuration (fee_bps must be ≤ 10000)
- `accepted_tokens` — Optional whitelist of token addresses; if omitted, only `token` is accepted

**Returns:** `Ok(())` on success, error code on failure

**Events:** Publishes `("campaign", "initialized")`

**Storage:** Instance storage (TTL managed by Soroban)

---

### contribute

Submit a contribution to the campaign.

**Signature:**
```rust
pub fn contribute(
    env: Env,
    contributor: Address,
    amount: i128,
    token: Address,
) -> Result<(), ContractError>
```

**Parameters:**
- `contributor` — Contributor's Stellar address (must authorize)
- `amount` — Contribution amount in stroops (must be ≥ min_contribution)
- `token` — Token address being contributed (must be in accepted tokens)

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Current time must be before deadline
- Amount must be ≥ min_contribution
- Token must be in accepted tokens list (or equal to default token)
- Campaign must not be paused

**Events:** Publishes `("campaign", "contributed", (contributor, amount))`

**Storage:** 
- Persistent: Updates contributor's total contribution amount
- Instance: Updates total_raised, contributor_count, largest_contribution

---

### withdraw

Creator claims funds after successful campaign.

**Signature:**
```rust
pub fn withdraw(env: Env) -> Result<(), ContractError>
```

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Current time must be ≥ deadline
- Total raised must be ≥ goal
- Caller must be campaign creator (must authorize)

**Behavior:**
1. Deducts platform fee (if configured) and transfers to platform address
2. Transfers remaining funds to creator
3. Sets campaign status to `Successful`
4. Clears total_raised to 0

**Events:** Publishes `("campaign", "withdrawn", (creator, total_amount))`

**Storage:** Instance storage updated

---

### refund_single

Contributor claims their refund after failed campaign.

**Signature:**
```rust
pub fn refund_single(
    env: Env,
    contributor: Address,
) -> Result<(), ContractError>
```

**Parameters:**
- `contributor` — Contributor's Stellar address (must authorize)

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Either:
  - Campaign status is `Cancelled`, OR
  - Current time is ≥ deadline AND total raised < goal
- Contributor must have a non-zero contribution

**Behavior:**
1. Transfers contributor's full contribution back to them
2. Sets their contribution to 0 (prevents double-refund)

**Events:** Publishes `("campaign", "refunded", (contributor, amount))`

**Storage:** Persistent storage updated

---

### update_metadata

Update campaign title, description, or social links.

**Signature:**
```rust
pub fn update_metadata(
    env: Env,
    title: Option<String>,
    description: Option<String>,
    social_links: Option<Vec<String>>,
) -> Result<(), ContractError>
```

**Parameters:**
- `title` — New title (optional)
- `description` — New description (optional)
- `social_links` — New social links array (optional)

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Caller must be campaign creator (must authorize)

**Events:** Publishes `("campaign", "metadata_updated")`

**Storage:** Instance storage updated

---

### extend_deadline

Extend campaign deadline.

**Signature:**
```rust
pub fn extend_deadline(env: Env, new_deadline: u64) -> Result<(), ContractError>
```

**Parameters:**
- `new_deadline` — New Unix timestamp (must be > current deadline)

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Caller must be campaign creator (must authorize)
- New deadline must be > current deadline

**Events:** Publishes `("campaign", "deadline_extended", new_deadline)`

**Storage:** Instance storage updated

---

### cancel_campaign

Creator cancels campaign, allowing all contributors to refund.

**Signature:**
```rust
pub fn cancel_campaign(env: Env) -> Result<(), ContractError>
```

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Caller must be campaign creator (must authorize)

**Behavior:**
- Sets campaign status to `Cancelled`
- Contributors can then call `refund_single` to claim refunds

**Events:** Publishes `("campaign", "cancelled")`

**Storage:** Instance storage updated

---

### pause

Admin pauses campaign (prevents new contributions).

**Signature:**
```rust
pub fn pause(env: Env) -> Result<(), ContractError>
```

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Active`
- Caller must be campaign creator/admin (must authorize)

**Behavior:**
- Sets campaign status to `Paused`
- Contributions are blocked until unpaused

**Events:** Publishes `("campaign", "paused")`

**Storage:** Instance storage updated

---

### unpause

Admin resumes paused campaign.

**Signature:**
```rust
pub fn unpause(env: Env) -> Result<(), ContractError>
```

**Returns:** `Ok(())` on success, error code on failure

**Preconditions:**
- Campaign status must be `Paused`
- Caller must be campaign creator/admin (must authorize)

**Behavior:**
- Sets campaign status back to `Active`
- Contributions are allowed again

**Events:** Publishes `("campaign", "unpaused")`

**Storage:** Instance storage updated

---

## Read-Only Functions

### get_stats

Fetch live campaign statistics.

**Signature:**
```rust
pub fn get_stats(env: Env) -> CampaignStats
```

**Returns:** `CampaignStats` struct with current metrics

**Storage:** Instance storage (read-only)

---

### get_campaign_info

Fetch complete campaign metadata and state.

**Signature:**
```rust
pub fn get_campaign_info(env: Env) -> CampaignInfo
```

**Returns:** `CampaignInfo` struct with all campaign details

**Storage:** Instance storage (read-only)

---

### total_raised

Get total amount raised so far.

**Signature:**
```rust
pub fn total_raised(env: Env) -> i128
```

**Returns:** Total raised in stroops

---

### goal

Get campaign funding goal.

**Signature:**
```rust
pub fn goal(env: Env) -> i128
```

**Returns:** Goal amount in stroops

---

### deadline

Get campaign deadline.

**Signature:**
```rust
pub fn deadline(env: Env) -> u64
```

**Returns:** Unix timestamp (seconds)

---

### status

Get current campaign status.

**Signature:**
```rust
pub fn status(env: Env) -> Status
```

**Returns:** Current `Status` enum value

---

### creator

Get campaign creator address.

**Signature:**
```rust
pub fn creator(env: Env) -> Address
```

**Returns:** Creator's Stellar address

---

### contribution

Get a specific contributor's total contribution.

**Signature:**
```rust
pub fn contribution(env: Env, contributor: Address) -> i128
```

**Parameters:**
- `contributor` — Contributor's Stellar address

**Returns:** Contribution amount in stroops (0 if no contribution)

**Storage:** Persistent storage (read-only)

---

### is_contributor

Check if an address has contributed.

**Signature:**
```rust
pub fn is_contributor(env: Env, address: Address) -> bool
```

**Parameters:**
- `address` — Stellar address to check

**Returns:** `true` if address has non-zero contribution, `false` otherwise

---

### min_contribution

Get minimum contribution amount.

**Signature:**
```rust
pub fn min_contribution(env: Env) -> i128
```

**Returns:** Minimum contribution in stroops

---

### title

Get campaign title.

**Signature:**
```rust
pub fn title(env: Env) -> String
```

**Returns:** Campaign title

---

### description

Get campaign description.

**Signature:**
```rust
pub fn description(env: Env) -> String
```

**Returns:** Campaign description

---

### social_links

Get campaign social links.

**Signature:**
```rust
pub fn social_links(env: Env) -> Vec<String>
```

**Returns:** Array of social media URLs or image CIDs

---

### accepted_tokens

Get whitelist of accepted tokens.

**Signature:**
```rust
pub fn accepted_tokens(env: Env) -> Vec<Address>
```

**Returns:** Array of accepted token addresses (empty if no whitelist)

---

### platform_config

Get platform fee configuration.

**Signature:**
```rust
pub fn platform_config(env: Env) -> Option<PlatformConfig>
```

**Returns:** `Some(PlatformConfig)` if configured, `None` otherwise

---

### version

Get contract version.

**Signature:**
```rust
pub fn version(_env: Env) -> u32
```

**Returns:** Contract version number (currently 3)

---

### contributor_list

Get paginated list of contributors.

**Signature:**
```rust
pub fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address>
```

**Parameters:**
- `offset` — Starting index (0-based)
- `limit` — Maximum results (capped at 50)

**Returns:** Array of contributor addresses

**Storage:** Persistent storage (read-only)

---

## Storage Layout

### Instance Storage

Stores campaign metadata and state. Persists for contract lifetime.

| Key | Type | Description |
|-----|------|-------------|
| `CREATOR` | Address | Campaign creator |
| `TOKEN` | Address | Primary token address |
| `GOAL` | i128 | Funding goal in stroops |
| `DEADLINE` | u64 | Unix timestamp deadline |
| `TOTAL` | i128 | Total raised in stroops |
| `STATUS` | Status | Current campaign status |
| `MIN` | i128 | Minimum contribution |
| `TITLE` | String | Campaign title |
| `DESC` | String | Campaign description |
| `SOCIAL` | Vec<String> | Social links/image CIDs |
| `PLATFORM` | PlatformConfig | Optional fee configuration |
| `ADMIN` | Address | Admin address (usually creator) |
| `ContributorCount` | u32 | Number of unique contributors |
| `LargestContribution` | i128 | Largest single contribution |
| `AcceptedTokens` | Vec<Address> | Whitelist of accepted tokens |

### Persistent Storage

Stores contributor-specific data with TTL management.

| Key | Type | Description | TTL |
|-----|------|-------------|-----|
| `Contribution(Address)` | i128 | Individual contribution amount | 100 ledgers |
| `ContributorPresence(Address)` | bool | Whether address has contributed | 100 ledgers |
| `CONTRIBS` | Vec<Address> | List of all contributors | 100 ledgers |

**TTL Strategy:** Persistent entries use threshold of 17,280 ledgers (~2 days) and extension of 518,400 ledgers (~60 days). This ensures data remains available for refunds and historical queries while managing storage costs.

---

## Events

All events use the topic pattern `("campaign", "<event_type>")`.

| Event | Data | Description |
|-------|------|-------------|
| `initialized` | `()` | Campaign created |
| `contributed` | `(contributor: Address, amount: i128)` | Contribution received |
| `withdrawn` | `(creator: Address, total: i128)` | Funds withdrawn by creator |
| `refunded` | `(contributor: Address, amount: i128)` | Refund issued to contributor |
| `metadata_updated` | `()` | Campaign metadata changed |
| `deadline_extended` | `new_deadline: u64` | Deadline extended |
| `cancelled` | `()` | Campaign cancelled |
| `paused` | `()` | Campaign paused |
| `unpaused` | `()` | Campaign resumed |

---

## Usage Examples

### Initialize Campaign

```rust
let platform_config = Some(PlatformConfig {
    address: platform_address,
    fee_bps: 250,  // 2.5% fee
});

initialize(
    env,
    creator,
    token_address,
    1_000_000_000,  // 100 XLM goal
    deadline_timestamp,
    10_000_000,     // 1 XLM minimum
    String::from_str(&env, "My Campaign"),
    String::from_str(&env, "Help us build..."),
    None,
    platform_config,
    None,
)?;
```

### Contribute

```rust
contribute(
    env,
    contributor,
    50_000_000,  // 5 XLM
    token_address,
)?;
```

### Withdraw (Creator)

```rust
// After deadline and if goal reached
withdraw(env)?;
```

### Refund (Contributor)

```rust
// After deadline if goal not met, or if campaign cancelled
refund_single(env, contributor)?;
```

---

## Security Considerations

1. **Authorization:** All state-changing functions require caller authorization via `require_auth()`
2. **Overflow Protection:** Arithmetic operations use `checked_add()` to prevent overflow
3. **Reentrancy:** Token transfers use Soroban's safe token interface
4. **TTL Management:** Persistent storage uses TTL to manage costs while ensuring data availability
5. **Pull-Based Refunds:** Refunds use pull model (contributor-initiated) to avoid single-point-of-failure
6. **Fee Validation:** Platform fees capped at 10,000 basis points (100%)

---

## Deployment Notes

- Contract is compiled to WASM and deployed to Stellar testnet/mainnet
- Each campaign gets its own contract instance
- Registry contract maintains list of active campaigns
- Soroban RPC endpoint required for interaction
- Freighter wallet integration for frontend signing
