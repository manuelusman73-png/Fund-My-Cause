/// Data types and structures for the crowdfund contract.
///
/// This module contains all `#[contracttype]` definitions including enums and structs
/// used throughout the contract for state management and function signatures.

use soroban_sdk::{contracttype, Address, String, Vec};

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
