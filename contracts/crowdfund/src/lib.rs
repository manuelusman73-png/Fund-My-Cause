#![no_std]
#![allow(missing_docs)]
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Vec,
};

const CONTRACT_VERSION: u32 = 3;

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

#[derive(Clone)]
#[contracttype]
pub struct PlatformConfig {
    pub address: Address,
    pub fee_bps: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Creator,
    Token,
    Goal,
    Deadline,
    TotalRaised,
    Contribution(Address),
    Contributors,
    Status,
    MinContribution,
    Admin,
    Title,
    Description,
    SocialLinks,
    PlatformConfig,
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
        if env.storage().instance().has(&DataKey::Creator) {
            return Err(ContractError::AlreadyInitialized);
        }
        creator.require_auth();

        if let Some(ref config) = platform_config {
            if config.fee_bps > 10_000 {
                panic!("platform fee cannot exceed 100%");
            }
            env.storage().instance().set(&DataKey::PlatformConfig, config);
        }

        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Goal, &goal);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::MinContribution, &min_contribution);
        env.storage().instance().set(&DataKey::Title, &title);
        env.storage().instance().set(&DataKey::Description, &description);

        if let Some(links) = social_links {
            env.storage().instance().set(&DataKey::SocialLinks, &links);
        }

        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage().instance().set(&DataKey::Status, &Status::Active);

        let empty: Vec<Address> = Vec::new(&env);
        env.storage().persistent().set(&DataKey::Contributors, &empty);

        Ok(())
    }

    /// Contribute tokens to the campaign.
    pub fn contribute(env: Env, contributor: Address, amount: i128) -> Result<(), ContractError> {
        contributor.require_auth();

        let min: i128 = env.storage().instance().get(&DataKey::MinContribution).unwrap();
        if amount < min {
            panic!("amount below minimum");
        }

        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() > deadline {
            return Err(ContractError::CampaignEnded);
        }

        let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token_address)
            .transfer(&contributor, &env.current_contract_address(), &amount);

        let key = DataKey::Contribution(contributor.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let new_amount = prev.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().persistent().set(&key, &new_amount);
        env.storage().persistent().extend_ttl(&key, 100, 100);

        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        let new_total = total.checked_add(amount).ok_or(ContractError::Overflow)?;
        env.storage().instance().set(&DataKey::TotalRaised, &new_total);

        let mut contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Contributors)
            .unwrap_or_else(|| Vec::new(&env));
        if !contributors.contains(&contributor) {
            contributors.push_back(contributor.clone());
            env.storage().persistent().set(&DataKey::Contributors, &contributors);
            env.storage().persistent().extend_ttl(&DataKey::Contributors, 100, 100);
        }

        env.events().publish(("campaign", "contributed"), (contributor, amount));
        Ok(())
    }

    /// Creator withdraws funds after a successful campaign.
    pub fn withdraw(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();
        creator.require_auth();

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() <= deadline {
            return Err(ContractError::CampaignStillActive);
        }

        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        if total < goal {
            return Err(ContractError::GoalNotReached);
        }

        let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_address);

        let payout = if let Some(config) = env
            .storage()
            .instance()
            .get::<_, PlatformConfig>(&DataKey::PlatformConfig)
        {
            let fee = total * config.fee_bps as i128 / 10_000;
            token_client.transfer(&env.current_contract_address(), &config.address, &fee);
            total - fee
        } else {
            total
        };

        token_client.transfer(&env.current_contract_address(), &creator, &payout);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage().instance().set(&DataKey::Status, &Status::Successful);
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
        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();
        creator.require_auth();

        if let Some(t) = title {
            env.storage().instance().set(&DataKey::Title, &t);
        }
        if let Some(d) = description {
            env.storage().instance().set(&DataKey::Description, &d);
        }
        if let Some(l) = social_links {
            env.storage().instance().set(&DataKey::SocialLinks, &l);
        }

        env.events().publish(("campaign", "metadata_updated"), ());
        Ok(())
    }

    /// Cancel a campaign before the deadline.
    pub fn cancel_campaign(env: Env) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();
        if status != Status::Active {
            return Err(ContractError::NotActive);
        }

        let creator: Address = env.storage().instance().get(&DataKey::Creator).unwrap();
        creator.require_auth();

        env.storage().instance().set(&DataKey::Status, &Status::Cancelled);
        env.events().publish(("campaign", "cancelled"), ());
        Ok(())
    }

    /// Pull-based refund — each contributor claims individually if goal not met.
    pub fn refund_single(env: Env, contributor: Address) -> Result<(), ContractError> {
        let status: Status = env.storage().instance().get(&DataKey::Status).unwrap();

        if status != Status::Cancelled {
            let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
            if env.ledger().timestamp() <= deadline {
                return Err(ContractError::CampaignStillActive);
            }

            let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
            let total: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
            if total >= goal {
                return Err(ContractError::GoalReached);
            }
        }

        let key = DataKey::Contribution(contributor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount > 0 {
            let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            token::Client::new(&env, &token_address)
                .transfer(&env.current_contract_address(), &contributor, &amount);
            env.storage().persistent().set(&key, &0i128);
        }
        Ok(())
    }

    // ── View functions ────────────────────────────────────────────────────────

    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0)
    }

    pub fn creator(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Creator).unwrap()
    }

    pub fn goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap()
    }

    pub fn deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap()
    }

    pub fn contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    pub fn min_contribution(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::MinContribution).unwrap()
    }

    pub fn title(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Title)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn description(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Description)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn social_links(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&DataKey::SocialLinks)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn version(_env: Env) -> u32 {
        CONTRACT_VERSION
    }

    pub fn get_stats(env: Env) -> CampaignStats {
        let total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0);
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let contributors: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Contributors)
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
