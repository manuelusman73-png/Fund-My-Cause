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

// ── Data Types ────────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum Status {
    Active,
    Successful,
    Refunded,
    Cancelled,
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
pub enum DataKey {
    Contribution(Address),
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
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&KEY_CREATOR) {
            return Err(ContractError::AlreadyInitialized);
        }
        creator.require_auth();

        if let Some(ref config) = platform_config {
            if config.fee_bps > 10_000 {
                panic!("platform fee cannot exceed 100%");
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

        env.storage().instance().set(&KEY_TOTAL, &0i128);
        env.storage().instance().set(&KEY_STATUS, &Status::Active);

        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&KEY_CONTRIBS, &empty);

        Ok(())
    }

    /// Contribute tokens to the campaign.
    pub fn contribute(env: Env, contributor: Address, amount: i128) -> Result<(), ContractError> {
        contributor.require_auth();

        let min: i128 = env.storage().instance().get(&KEY_MIN).unwrap();
        if amount < min {
            panic!("amount below minimum");
        }

        let status: Status = env.storage().instance().get(&KEY_STATUS).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let deadline: u64 = env.storage().instance().get(&KEY_DEADLINE).unwrap();
        if env.ledger().timestamp() > deadline {
            return Err(ContractError::CampaignEnded);
        }

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

        env.events().publish(("campaign", "metadata_updated"), ());
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
        }
        Ok(())
    }

    // ── View functions ────────────────────────────────────────────────────────

    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&KEY_TOTAL).unwrap_or(0)
    }

    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&KEY_CREATOR).unwrap()
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

    pub fn platform_config(env: Env) -> Option<PlatformConfig> {
        env.storage().instance().get(&DataKey::PlatformConfig)
    }

    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    pub fn get_stats(env: Env) -> CampaignStats {
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

        let contributor_count = contributors.len();
        let (average_contribution, largest_contribution) = if contributor_count == 0 {
            (0, 0)
        } else {
            let avg = total_raised / contributor_count as i128;
            let mut largest = 0i128;
            for c in contributors.iter() {
                let amt: i128 = env
                    .storage()
                    .persistent()
                    .get(&DataKey::Contribution(c))
                    .unwrap_or(0);
                if amt > largest {
                    largest = amt;
                }
            }
            (avg, largest)
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
}

#[cfg(test)]
mod test;
