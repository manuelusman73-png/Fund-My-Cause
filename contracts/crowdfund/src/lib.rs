#![no_std]
#![allow(missing_docs)]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol, Vec,
};

const CONTRACT_VERSION: u32 = 3;

// ── Storage Keys ──────────────────────────────────────────────────────────────
const KEY_CREATOR: Symbol = symbol_short!("CREATOR");
const KEY_TOKEN: Symbol = symbol_short!("TOKEN");
const KEY_GOAL: Symbol = symbol_short!("GOAL");
const KEY_DEADLINE: Symbol = symbol_short!("DEADLINE");
const KEY_TOTAL: Symbol = symbol_short!("TOTAL");
const KEY_CONTRIBS: Symbol = symbol_short!("CONTRIBS");
const KEY_STATUS: Symbol = symbol_short!("STATUS");
const KEY_MIN: Symbol = symbol_short!("MIN");
const KEY_TITLE: Symbol = symbol_short!("TITLE");
const KEY_DESC: Symbol = symbol_short!("DESC");
const KEY_SOCIAL: Symbol = symbol_short!("SOCIAL");
const KEY_PLATFORM: Symbol = symbol_short!("PLATFORM");
const KEY_ADMIN: Symbol = symbol_short!("ADMIN");

// ── Data Types ────────────────────────────────────────────────────────────────

/// Campaign status enumeration.
///
/// Represents the lifecycle state of a crowdfunding campaign.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum Status {
    /// Campaign is accepting contributions
    Active,
    /// Campaign deadline passed and goal was reached
    Successful,
    /// Campaign deadline passed and goal was not reached (refunds available)
    Refunded,
    /// Campaign was cancelled by creator (refunds available)
    Cancelled,
    /// Campaign is temporarily paused (no new contributions allowed)
    Paused,
}

/// Campaign statistics snapshot.
///
/// Contains aggregated metrics about campaign progress and contributor activity.
#[derive(Clone)]
#[contracttype]
pub struct CampaignStats {
    /// Total amount raised in stroops
    pub total_raised: i128,
    /// Campaign funding goal in stroops
    pub goal: i128,
    /// Progress as basis points (0-10000, where 10000 = 100%)
    pub progress_bps: u32,
    /// Number of unique contributors
    pub contributor_count: u32,
    /// Average contribution amount in stroops (total_raised / contributor_count)
    pub average_contribution: i128,
    /// Largest single contribution amount in stroops
    pub largest_contribution: i128,
}

/// Platform fee configuration.
///
/// Specifies the address that receives platform fees and the fee percentage.
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct PlatformConfig {
    /// Address that receives platform fees
    pub address: Address,
    /// Fee percentage in basis points (e.g., 250 = 2.5%)
    pub fee_bps: u32,
}

/// Complete campaign information.
///
/// Contains all metadata and configuration for a campaign.
#[derive(Clone)]
#[contracttype]
pub struct CampaignInfo {
    /// Campaign creator's Stellar address
    pub creator: Address,
    /// Token address for contributions
    pub token: Address,
    /// Funding goal in stroops
    pub goal: i128,
    /// Campaign deadline as Unix timestamp (seconds)
    pub deadline: u64,
    /// Minimum contribution amount in stroops
    pub min_contribution: i128,
    /// Campaign title
    pub title: String,
    /// Campaign description
    pub description: String,
    /// Current campaign status
    pub status: Status,
    /// Whether a platform fee is configured
    pub has_platform_config: bool,
    /// Platform fee in basis points (0 if no config)
    pub platform_fee_bps: u32,
    /// Platform fee recipient address
    pub platform_address: Address,
}

/// Storage key variants for contract data.
///
/// Used to organize persistent and instance storage in the contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Contribution amount for a specific address
    Contribution(Address),
    /// Whether an address has contributed (presence flag)
    ContributorPresence(Address),
    /// Total number of unique contributors
    ContributorCount,
    /// Largest single contribution amount
    LargestContribution,
    /// Whitelist of accepted token addresses
    AcceptedTokens,
}

// ── Contract Errors ───────────────────────────────────────────────────────────

use soroban_sdk::contracterror;

/// Contract error types.
///
/// Represents all possible error conditions that can occur during contract execution.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Campaign has already been initialized
    AlreadyInitialized = 1,
    /// Campaign deadline has passed
    CampaignEnded = 2,
    /// Campaign deadline has not yet passed
    CampaignStillActive = 3,
    /// Campaign goal was not reached
    GoalNotReached = 4,
    /// Campaign goal was already reached
    GoalReached = 5,
    /// Arithmetic overflow occurred
    Overflow = 6,
    /// Campaign is not in Active status
    NotActive = 7,
    /// Platform fee is invalid (> 10,000 bps)
    InvalidFee = 8,
    /// Amount is below minimum contribution
    BelowMinimum = 9,
    /// Deadline is invalid
    InvalidDeadline = 10,
    /// Campaign is paused
    CampaignPaused = 11,
    /// Campaign goal is invalid (<= 0)
    InvalidGoal = 12,
    /// Token is not accepted by this campaign
    TokenNotAccepted = 13,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initializes a new crowdfunding campaign.
    ///
    /// Creates a campaign with the specified parameters. Can only be called once per contract instance.
    /// The creator must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `creator` - The campaign creator's Stellar address (must authorize)
    /// * `token` - The token address for contributions (e.g., native XLM or custom token)
    /// * `goal` - The funding goal in stroops (must be > 0)
    /// * `deadline` - Unix timestamp (seconds) when the campaign ends (must be > current ledger time)
    /// * `min_contribution` - Minimum contribution amount in stroops (must be >= 0)
    /// * `title` - Campaign title
    /// * `description` - Campaign description
    /// * `social_links` - Optional list of social media URLs
    /// * `platform_config` - Optional platform fee configuration (address and fee_bps)
    /// * `accepted_tokens` - Optional whitelist of accepted token addresses
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::AlreadyInitialized)` if campaign already initialized
    /// * `Err(ContractError::InvalidGoal)` if goal <= 0
    /// * `Err(ContractError::InvalidDeadline)` if deadline <= current time
    /// * `Err(ContractError::InvalidFee)` if platform fee_bps > 10,000
    ///
    /// # Example
    /// ```ignore
    /// initialize(
    ///     env,
    ///     creator_address,
    ///     token_address,
    ///     1_000_000_000,  // 100 XLM goal
    ///     1704067200,     // deadline timestamp
    ///     1_000_000,      // 0.1 XLM minimum
    ///     String::from_str(&env, "My Campaign"),
    ///     String::from_str(&env, "Help fund my project"),
    ///     None,
    ///     None,
    ///     None,
    /// )
    /// ```
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
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&KEY_CREATOR) {
            return Err(ContractError::AlreadyInitialized);
        }
        creator.require_auth();

        if goal <= 0 {
            return Err(ContractError::InvalidGoal);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(ContractError::InvalidDeadline);
        }
        if min_contribution < 0 {
            return Err(ContractError::BelowMinimum);
        }

        if let Some(ref config) = platform_config {
            if config.fee_bps > 10_000 {
                return Err(ContractError::InvalidFee);
            }
            env.storage().instance().set(&KEY_PLATFORM, config);
        }

        env.storage().instance().set(&KEY_ADMIN, &creator);
        env.storage().instance().set(&KEY_CREATOR, &creator);
        env.storage().instance().set(&KEY_TOKEN, &token);
        env.storage().instance().set(&KEY_GOAL, &goal);
        env.storage().instance().set(&KEY_DEADLINE, &deadline);
        env.storage().instance().set(&KEY_MIN, &min_contribution);
        env.storage().instance().set(&KEY_TITLE, &title);
        env.storage().instance().set(&KEY_DESC, &description);
        env.storage().instance().set(&KEY_TOTAL, &0i128);
        env.storage().instance().set(&KEY_STATUS, &Status::Active);
        env.storage().instance().set(&DataKey::ContributorCount, &0u32);
        env.storage().instance().set(&DataKey::LargestContribution, &0i128);

        if let Some(links) = social_links {
            env.storage().instance().set(&KEY_SOCIAL, &links);
        }

        env.storage().instance().set(&DataKey::ContributorCount, &0u32);
        env.storage().instance().set(&DataKey::LargestContribution, &0i128);

        if let Some(tokens) = accepted_tokens {
            env.storage().instance().set(&DataKey::AcceptedTokens, &tokens);
        }

        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&KEY_CONTRIBS, &empty);

        env.events().publish(("campaign", "initialized"), ());
        Ok(())
    }

    /// Submits a contribution to the campaign.
    ///
    /// Allows a contributor to pledge tokens before the campaign deadline.
    /// The contributor must authorize this transaction and have sufficient token balance.
    /// Uses a pull-based refund model: contributors claim refunds individually if the goal is not met.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address (must authorize)
    /// * `amount` - Contribution amount in stroops (must be >= min_contribution)
    /// * `token` - The token address being contributed (must match campaign token or be in whitelist)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::BelowMinimum)` if amount < min_contribution
    /// * `Err(ContractError::CampaignPaused)` if campaign is paused
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignEnded)` if current time >= deadline
    /// * `Err(ContractError::TokenNotAccepted)` if token not in whitelist
    /// * `Err(ContractError::Overflow)` if total raised would overflow
    ///
    /// # Side Effects
    /// - Transfers tokens from contributor to contract
    /// - Updates contributor's total contribution amount
    /// - Increments contributor count if this is their first contribution
    /// - Updates largest contribution if applicable
    /// - Publishes "contributed" event
    pub fn contribute(env: Env, contributor: Address, amount: i128, token: Address) -> Result<(), ContractError> {
        contributor.require_auth();

        let min: i128 = env.storage().instance().get(&KEY_MIN).unwrap();
        if amount < min {
            return Err(ContractError::BelowMinimum);
        }

        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status == Status::Paused {
            return Err(ContractError::CampaignPaused);
        }
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() >= deadline {
            return Err(ContractError::CampaignEnded);
        }

        // Validate token against whitelist if one is set, otherwise fall back to default token
        let default_token: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        if let Some(whitelist) = env.storage().instance().get::<_, Vec<Address>>(&DataKey::AcceptedTokens) {
            if !whitelist.contains(&token) {
                return Err(ContractError::TokenNotAccepted);
            }
        } else if token != default_token {
            return Err(ContractError::TokenNotAccepted);
        }

        token::Client::new(&env, &token)
            .transfer(&contributor, &env.current_contract_address(), &amount);

        let key = DataKey::Contribution(contributor.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_amount = prev.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().persistent().set(&key, &new_amount);
        env.storage().persistent().extend_ttl(&key, 100, 100);

        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
        let new_total = total.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().instance().set(&KEY_TOTAL, &new_total);

        let presence_key = DataKey::ContributorPresence(contributor.clone());
        let is_present: bool = env.storage().persistent().get(&presence_key).unwrap_or(false);
        if !is_present {
            env.storage().persistent().set(&presence_key, &true);
            env.storage().persistent().extend_ttl(&presence_key, 100, 100);
            let count: u32 = env.storage().instance().get(&DataKey::ContributorCount).unwrap();
            env.storage().instance().set(&DataKey::ContributorCount, &(count + 1));

            let mut contributors: Vec<Address> = env
                .storage()
                .persistent()
                .get(&KEY_CONTRIBS)
                .unwrap_or_else(|| Vec::new(&env));
            contributors.push_back(contributor.clone());
            env.storage().persistent().set(&KEY_CONTRIBS, &contributors);
            env.storage().persistent().extend_ttl(&KEY_CONTRIBS, 100, 100);
        }

        let largest: i128 = env.storage().instance().get(&DataKey::LargestContribution).unwrap();
        if new_amount > largest {
            env.storage().instance().set(&DataKey::LargestContribution, &new_amount);
        }

        let mut contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&KEY_CONTRIBS)
            .unwrap_or_else(|| Vec::new(&env));
        if !contributors.contains(&contributor) {
            contributors.push_back(contributor.clone());
            env.storage().persistent().set(&KEY_CONTRIBS, &contributors);
            env.storage().persistent().extend_ttl(&KEY_CONTRIBS, 100, 100);
        }

        env.storage().instance().extend_ttl(17280, 518400);
        env.events().publish(("campaign", "contributed"), (contributor, amount));
        Ok(())
    }

    /// Withdraws raised funds to the campaign creator after a successful campaign.
    ///
    /// Can only be called after the deadline has passed and the goal has been reached.
    /// The creator must authorize this transaction.
    /// If a platform fee is configured, it is deducted from the total before payout.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::CampaignStillActive)` if current time < deadline
    /// * `Err(ContractError::GoalNotReached)` if total_raised < goal
    ///
    /// # Side Effects
    /// - Transfers platform fee to platform address (if configured)
    /// - Transfers remaining funds to creator
    /// - Sets campaign status to Successful
    /// - Resets total_raised to 0
    /// - Publishes "withdrawn" event
    ///
    /// # Platform Fee Calculation
    /// If platform_config is set:
    /// ```ignore
    /// fee = total_raised * platform_fee_bps / 10_000
    /// creator_payout = total_raised - fee
    /// ```
    pub fn withdraw(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() < deadline {
            return Err(ContractError::CampaignStillActive);
        }

        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
        if total < goal {
            return Err(ContractError::GoalNotReached);
        }

        let token_address: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_address);

        let payout = if let Some(config) = env.storage().instance().get::<_, PlatformConfig>(&KEY_PLATFORM) {
            let fee = total * config.fee_bps as i128 / 10_000;
            token_client.transfer(&env.current_contract_address(), &config.address, &fee);
            total - fee
        } else {
            total
        };

        token_client.transfer(&env.current_contract_address(), &creator, &payout);

        // Extend instance storage TTL after successful withdrawal.
        // This ensures contract metadata remains accessible for historical reference
        // and potential future interactions (e.g., viewing campaign results).
        // Uses same TTL strategy as contribute: threshold 17280, extension 518400 ledgers.
        env.storage().instance().extend_ttl(17280, 518400);

        env.storage().instance().set(&KEY_TOTAL, &0i128);
        env.storage().instance().set(&KEY_STATUS, &Status::Successful);
        env.storage().instance().extend_ttl(17280, 518400);
        env.events().publish(("campaign", "withdrawn"), (creator, total));
        Ok(())
    }

    /// Updates campaign metadata (title, description, social links).
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// Any field can be omitted (None) to leave it unchanged.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `title` - New campaign title (optional)
    /// * `description` - New campaign description (optional)
    /// * `social_links` - New social media links (optional)
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Updates specified metadata fields in storage
    /// - Publishes "metadata_updated" event
    pub fn update_metadata(
        env: Env,
        title: Option<String>,
        description: Option<String>,
        social_links: Option<Vec<String>>,
    ) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        if let Some(t) = title { env.storage().instance().set(&KEY_TITLE, &t); }
        if let Some(d) = description { env.storage().instance().set(&KEY_DESC, &d); }
        if let Some(l) = social_links { env.storage().instance().set(&KEY_SOCIAL, &l); }

        env.events().publish(("campaign", "metadata_updated"), ());
        Ok(())
    }

    /// Extends the campaign deadline to a later time.
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// The new deadline must be strictly greater than the current deadline.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `new_deadline` - New Unix timestamp (seconds) for campaign end
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    /// * `Err(ContractError::InvalidDeadline)` if new_deadline <= current_deadline
    ///
    /// # Side Effects
    /// - Updates deadline in storage
    /// - Publishes "deadline_extended" event with new deadline
    pub fn extend_deadline(env: Env, new_deadline: u64) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let current_deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if new_deadline <= current_deadline {
            return Err(ContractError::InvalidDeadline);
        }
        env.storage().instance().set(&KEY_DEADLINE, &new_deadline);
        env.events().publish(("campaign", "deadline_extended"), new_deadline);
        Ok(())
    }

    /// Cancels the campaign, allowing all contributors to claim refunds.
    ///
    /// Can only be called while the campaign is in Active status.
    /// The creator must authorize this transaction.
    /// After cancellation, contributors can call `refund_single` to claim their refunds.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Sets campaign status to Cancelled
    /// - Publishes "cancelled" event
    pub fn cancel_campaign(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();
        env.storage().instance().set(&KEY_STATUS, &Status::Cancelled);
        env.events().publish(("campaign", "cancelled"), ());
        Ok(())
    }

    /// Claims a refund for a single contributor (pull-based refund model).
    ///
    /// A contributor can claim their refund if:
    /// - The campaign was cancelled, OR
    /// - The deadline has passed AND the goal was not reached
    ///
    /// This implements a pull-based refund model where each contributor individually
    /// claims their refund, avoiding the gas cost and failure risk of a single
    /// transaction refunding all contributors.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address claiming the refund
    ///
    /// # Returns
    /// * `Ok(())` on success (even if contributor has no refund)
    /// * `Err(ContractError::CampaignStillActive)` if deadline not passed and not cancelled
    /// * `Err(ContractError::GoalReached)` if goal was reached and campaign not cancelled
    ///
    /// # Side Effects
    /// - Transfers refund amount to contributor (if > 0)
    /// - Sets contributor's contribution to 0
    /// - Publishes "refunded" event
    pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();

        if status != Status::Cancelled {
            let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
            if env.ledger().timestamp() < deadline {
                return Err(ContractError::CampaignStillActive);
            }
            let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
            let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
            if total >= goal {
                return Err(ContractError::GoalReached);
            }
        }

        let key = DataKey::Contribution(contributor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > 0 {
            let token_address: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
            token::Client::new(&env, &token_address)
                .transfer(&env.current_contract_address(), &contributor, &amount);
            env.storage().persistent().set(&key, &0i128);
            env.events().publish(("campaign", "refunded"), (contributor, amount));
        }
        Ok(())
    }

    /// Pauses the campaign, preventing new contributions.
    ///
    /// Can only be called while the campaign is in Active status.
    /// The admin (creator) must authorize this transaction.
    /// While paused, contributors cannot make new contributions.
    /// The campaign can be resumed with `unpause`.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Active status
    ///
    /// # Side Effects
    /// - Sets campaign status to Paused
    /// - Publishes "paused" event
    pub fn pause(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage().instance().set(&KEY_STATUS, &Status::Paused);
        env.events().publish(("campaign", "paused"), ());
        Ok(())
    }

    /// Resumes a paused campaign, allowing contributions again.
    ///
    /// Can only be called while the campaign is in Paused status.
    /// The admin (creator) must authorize this transaction.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(ContractError::NotActive)` if campaign is not in Paused status
    ///
    /// # Side Effects
    /// - Sets campaign status to Active
    /// - Publishes "unpaused" event
    pub fn unpause(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Paused {
            return Err(ContractError::NotActive);
        }
        let admin: Address = env.storage().instance().get(&KEY_ADMIN).unwrap();
        admin.require_auth();
        env.storage().instance().set(&KEY_STATUS, &Status::Active);
        env.events().publish(("campaign", "unpaused"), ());
        Ok(())
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns the total amount raised so far in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Total raised amount (i128), or 0 if not yet initialized
    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
    }

    /// Returns the campaign creator's Stellar address.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Creator's address
    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&KEY_CREATOR).unwrap()
    }

    /// Returns the current campaign status.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Current Status (Active, Successful, Refunded, Cancelled, or Paused)
    pub fn status(env: Env) -> Status {
        env.storage().instance().get(&KEY_STATUS).unwrap()
    }

    /// Returns the campaign funding goal in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Goal amount (i128)
    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&KEY_GOAL).unwrap()
    }

    /// Returns the campaign deadline as a Unix timestamp (seconds).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Deadline timestamp (u64)
    pub fn deadline(env: Env) -> u64 {
        env.storage().instance().get(&KEY_DEADLINE).unwrap()
    }

    /// Returns the total contribution amount for a specific contributor in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `contributor` - The contributor's Stellar address
    ///
    /// # Returns
    /// Total contribution amount (i128), or 0 if no contributions
    pub fn contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    /// Checks if an address has made any contributions to the campaign.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - The address to check
    ///
    /// # Returns
    /// true if the address has contributed, false otherwise
    pub fn is_contributor(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Contribution(address))
            .unwrap_or(0)
            > 0
    }

    /// Returns the minimum contribution amount in stroops.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Minimum contribution amount (i128)
    pub fn min_contribution(env: Env) -> i128 {
        env.storage().instance().get(&KEY_MIN).unwrap()
    }

    /// Returns the campaign title.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign title string
    pub fn title(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    /// Returns the campaign description.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Campaign description string
    pub fn description(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    /// Returns the campaign's social media links.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of social media URLs
    pub fn social_links(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&KEY_SOCIAL)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns the list of accepted token addresses (whitelist).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Vector of accepted token addresses, or empty if no whitelist is set
    pub fn accepted_tokens(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AcceptedTokens)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns the platform fee configuration (if set).
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// Optional PlatformConfig containing address and fee_bps
    pub fn platform_config(env: Env) -> Option<PlatformConfig> {
        env.storage().instance().get(&KEY_PLATFORM)
    }

    /// Returns the contract version number.
    ///
    /// # Arguments
    /// * `_env` - The Soroban environment (unused)
    ///
    /// # Returns
    /// Contract version (u32)
    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    /// Returns comprehensive campaign statistics.
    ///
    /// Includes total raised, goal, progress percentage, contributor count,
    /// average contribution, and largest single contribution.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignStats struct with all metrics
    ///
    /// # Progress Calculation
    /// progress_bps = (total_raised * 10_000) / goal, capped at 10_000 (100%)
    pub fn get_stats(env: Env) -> CampaignStats {
        let contributor_count: u32 = env.storage().instance().get(&DataKey::ContributorCount).unwrap_or(0);
        let largest_contribution: i128 = env.storage().instance().get(&DataKey::LargestContribution).unwrap_or(0);
        let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();

        let progress_bps = if goal > 0 {
            let raw = (total_raised * 10_000) / goal;
            if raw > 10_000 { 10_000 } else { raw as u32 }
        } else {
            0
        };

        let average_contribution = if contributor_count == 0 {
            0
        } else {
            total_raised / contributor_count as i128
        };

        CampaignStats {
            total_raised,
            goal,
            progress_bps,
            contributor_count,
            average_contribution,
            largest_contribution,
        }
    }

    /// Returns comprehensive campaign information.
    ///
    /// Includes creator, token, goal, deadline, minimum contribution, metadata,
    /// status, and platform fee configuration.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// CampaignInfo struct with all campaign details
    pub fn get_campaign_info(env: Env) -> CampaignInfo {
        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        let token: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        let min_contribution: i128 = env.storage().instance().get(&KEY_MIN).unwrap();
        let title: String = env.storage()
            .instance()
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let description: String = env.storage()
            .instance()
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        
        let platform_config: Option<PlatformConfig> = env.storage()
            .instance()
            .get(&KEY_PLATFORM);

        let (has_platform_config, platform_fee_bps, platform_address) =
            if let Some(config) = env.storage().instance().get::<_, PlatformConfig>(&KEY_PLATFORM) {
                (true, config.fee_bps, config.address)
            } else {
                (false, 0, creator.clone())
            };

        CampaignInfo {
            creator,
            token,
            goal,
            deadline,
            min_contribution,
            title,
            description,
            status,
            has_platform_config,
            platform_fee_bps,
            platform_address,
        }
    }

    /// Returns a paginated list of contributor addresses.
    ///
    /// Useful for iterating through all contributors without loading the entire list.
    /// The limit is capped at 50 to prevent excessive memory usage.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `offset` - Starting index in the contributor list (0-based)
    /// * `limit` - Maximum number of contributors to return (capped at 50)
    ///
    /// # Returns
    /// Vector of contributor addresses for the requested page
    ///
    /// # Example
    /// ```ignore
    /// // Get first 10 contributors
    /// let page1 = contributor_list(env, 0, 10);
    /// // Get next 10 contributors
    /// let page2 = contributor_list(env, 10, 10);
    /// ```
    pub fn contributor_list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&KEY_CONTRIBS)
            .unwrap_or_else(|| Vec::new(&env));

        let total_count = contributors.len();
        if offset >= total_count {
            return Vec::new(&env);
        }

        let capped_limit = if limit > 50 { 50 } else { limit };
        let end = (offset + capped_limit).min(total_count);

        let mut result = Vec::new(&env);
        for i in offset..end {
            result.push_back(contributors.get(i).unwrap());
        }
        result
    }
}

#[cfg(test)]
mod test;
