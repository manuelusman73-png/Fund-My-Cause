/// Error types for the crowdfund contract.
///
/// This module defines all possible error conditions that can occur during contract execution.

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
