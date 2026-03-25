#![no_std]
#![allow(missing_docs)]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol, Vec,
};

const CONTRACT_VERSION: u32 = 3;

// ── Storage Keys ──────────────────────────────────────────────────────────────
//
// DESIGN DECISION: Symbol vs DataKey enum
//
// We use Symbol constants for simple storage keys (those without associated data)
// and reserve the DataKey enum only for keys that carry data (e.g., Contribution(Address)).
//
// Benefits:
// - Lower storage overhead: Symbol is more compact than enum variants
// - Reduced serialization cost: Symbols are primitive types
// - Cleaner code: Direct key usage without enum wrapping
//
// Trade-offs:
// - Less type safety: Symbols are just strings, no compile-time variant checking
// - Manual key management: Must ensure uniqueness manually
//
// This is a common pattern in Soroban contracts where performance matters.
// symbol_short! creates compile-time validated symbols (max 9 chars).
//
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

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum Status {
    Active,
    Successful,
    Refunded,
    Cancelled,
    Paused,
}

#[derive(Clone)]
#[contracttype]
pub struct CampaignStats {
    pub total_raised: i128,
    pub goal: i128,
    pub progress_bps: u32,
    pub contributor_count: u32,
    pub average_contribution: i128,
    pub largest_contribution: i128,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct PlatformConfig {
    pub address: Address,
    pub fee_bps: u32,
}

// DataKey now only used for variants that carry data
#[derive(Clone)]
#[contracttype]
pub struct CampaignInfo {
    pub creator: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub min_contribution: i128,
    pub title: String,
    pub description: String,
    pub status: Status,
    pub has_platform_config: bool,
    pub platform_fee_bps: u32,
    pub platform_address: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Contribution(Address),
    Status,
    MinContribution,
    Admin,
    Title,
    Description,
    SocialLinks,
    PlatformConfig,
    ContributorPresence(Address),
    ContributorCount,
    LargestContribution,
    AcceptedTokens,
}

// ── Contract Errors ───────────────────────────────────────────────────────────

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    CampaignEnded = 2,
    CampaignStillActive = 3,
    GoalNotReached = 4,
    GoalReached = 5,
    Overflow = 6,
    NotActive = 7,
    InvalidFee = 8,
    BelowMinimum = 9,
    InvalidDeadline = 8,
    CampaignPaused = 9,
    InvalidFee = 10,
    BelowMinimum = 11,
    InvalidGoal = 12,
    TokenNotAccepted = 8,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initialize a new Fund-My-Cause campaign.
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
        env.storage().instance().set(&KEY_ADMIN, &creator);

        if let Some(ref config) = platform_config {
            if config.fee_bps > 10_000 {
                return Err(ContractError::InvalidFee);
            }
            env.storage().instance().set(&KEY_PLATFORM, config);
        }

        env.storage().instance().set(&KEY_CREATOR, &creator);
        env.storage().instance().set(&KEY_TOKEN, &token);
        env.storage().instance().set(&KEY_GOAL, &goal);
        env.storage().instance().set(&KEY_DEADLINE, &deadline);
        env.storage().instance().set(&KEY_MIN, &min_contribution);
        env.storage().instance().set(&KEY_TITLE, &title);
        env.storage().instance().set(&KEY_DESC, &description);

        if let Some(links) = social_links {
            env.storage().instance().set(&KEY_SOCIAL, &links);
        }

        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage().instance().set(&DataKey::Status, &Status::Active);
        env.storage().instance().set(&DataKey::ContributorCount, &0u32);
        env.storage().instance().set(&DataKey::LargestContribution, &0i128);

        if let Some(tokens) = accepted_tokens {
            env.storage().instance().set(&DataKey::AcceptedTokens, &tokens);
        }
        env.storage().instance().set(&KEY_TOTAL, &0i128);
        env.storage().instance().set(&KEY_STATUS, &Status::Active);

        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&KEY_CONTRIBS, &empty);

        // Event: Campaign initialized
        env.events().publish(("campaign", "initialized"), ());

        Ok(())
    }

    /// Contribute tokens to the campaign.
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
        if env.ledger().timestamp() > deadline {
            return Err(ContractError::CampaignEnded);
        }

        // Validate token against whitelist if one is set, otherwise fall back to default token
        let default_token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        if let Some(whitelist) = env.storage().instance().get::<_, Vec<Address>>(&DataKey::AcceptedTokens) {
            if !whitelist.contains(&token) {
                return Err(ContractError::TokenNotAccepted);
            }
        } else if token != default_token {
            return Err(ContractError::TokenNotAccepted);
        }

        token::Client::new(&env, &token)
        let token_address: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        token::Client::new(&env, &token_address)
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
        }

        let largest: i128 = env.storage().instance().get(&DataKey::LargestContribution).unwrap();
        if new_amount > largest {
            env.storage().instance().set(&DataKey::LargestContribution, &new_amount);
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

        env.events().publish(("campaign", "contributed"), (contributor, amount));
        Ok(())
    }

    /// Creator withdraws funds after a successful campaign.
    pub fn withdraw(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let creator: Address = env.storage().instance().get(&KEY_CREATOR).unwrap();
        creator.require_auth();

        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() <= deadline {
            return Err(ContractError::CampaignStillActive);
        }

        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let total: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap();
        if total < goal {
            return Err(ContractError::GoalNotReached);
        }

        let token_address: Address = env.storage().instance().get(&KEY_TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_address);

        let payout = if let Some(config) = env
            .storage()
            .instance()
            .get::<_, PlatformConfig>(&KEY_PLATFORM)
        {
            let fee = total * config.fee_bps as i128 / 10_000;
            token_client.transfer(&env.current_contract_address(), &config.address, &fee);
            total - fee
        } else {
            total
        };

        token_client.transfer(&env.current_contract_address(), &creator, &payout);
        env.storage().instance().set(&KEY_TOTAL, &0i128);
        env.storage().instance().set(&KEY_STATUS, &Status::Successful);
        env.events().publish(("campaign", "withdrawn"), (creator, total));
        Ok(())
    }

    /// Update campaign metadata.
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

        if let Some(t) = title {
            env.storage().instance().set(&KEY_TITLE, &t);
        }
        if let Some(d) = description {
            env.storage().instance().set(&KEY_DESC, &d);
        }
        if let Some(l) = social_links {
            env.storage().instance().set(&KEY_SOCIAL, &l);
        }

        // Event: Campaign metadata updated
        env.events().publish(("campaign", "metadata_updated"), ());
        Ok(())
    }

    /// Extend the campaign deadline (only forward, only while Active).
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

    /// Cancel a campaign before the deadline.
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

    /// Pull-based refund — each contributor claims individually if goal not met.
    pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();

        if status != Status::Cancelled {
            let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
            if env.ledger().timestamp() <= deadline {
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

            // Event: Contributor refunded with amount
            env.events().publish(("campaign", "refunded"), (contributor, amount));
        }
        Ok(())
    }

    /// Pause an active campaign (admin only).
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

    /// Unpause a paused campaign (admin only).
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

    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
    }

    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&KEY_CREATOR).unwrap()
    }

    pub fn status(env: Env) -> Status {
        env.storage().instance().get(&DataKey::Status).unwrap()
    }

    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&KEY_GOAL).unwrap()
    }

    pub fn deadline(env: Env) -> u64 {
        env.storage().instance().get(&KEY_DEADLINE).unwrap()
    }

    pub fn contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    pub fn is_contributor(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, i128>(&DataKey::Contribution(address))
            .unwrap_or(0)
            > 0
    }

    pub fn min_contribution(env: Env) -> i128 {
        env.storage().instance().get(&KEY_MIN).unwrap()
    }

    pub fn title(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_TITLE)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn description(env: Env) -> String {
        env.storage()
            .instance()
            .get(&KEY_DESC)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn social_links(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&KEY_SOCIAL)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn accepted_tokens(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AcceptedTokens)
            .unwrap_or_else(|| Vec::new(&env))
    pub fn platform_config(env: Env) -> Option<PlatformConfig> {
        env.storage().instance().get(&KEY_PLATFORM)
    }

    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    pub fn get_stats(env: Env) -> CampaignStats {
        let total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0);
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let contributor_count: u32 = env.storage().instance().get(&DataKey::ContributorCount).unwrap_or(0);
        let largest_contribution: i128 = env.storage().instance().get(&DataKey::LargestContribution).unwrap_or(0);
        let total_raised: i128 = env.storage().instance().get(&KEY_TOTAL).unwrap_or(0);
        let goal: i128 = env.storage().instance().get(&KEY_GOAL).unwrap();
        let contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&KEY_CONTRIBS)
            .unwrap_or_else(|| Vec::new(&env));

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

    pub fn get_campaign_info(env: Env) -> CampaignInfo {
        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        let min_contribution: i128 = env.storage().instance().get(&DataKey::MinContribution).unwrap();
        let title: String = env.storage()
            .instance()
            .get(&DataKey::Title)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let description: String = env.storage()
            .instance()
            .get(&DataKey::Description)
            .unwrap_or_else(|| String::from_str(&env, ""));
        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();
        
        let platform_config: Option<PlatformConfig> = env.storage()
            .instance()
            .get(&DataKey::PlatformConfig);

        let (has_platform_config, platform_fee_bps, platform_address) = if let Some(config) = platform_config {
            (true, config.fee_bps, config.address)
        } else {
            // Default values when no platform config exists
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
}

#[cfg(test)]
mod test;
