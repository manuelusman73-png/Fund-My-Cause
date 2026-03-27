#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address, Env, IntoVal, Val, Vec,
};
use crate::{CrowdfundContract, CrowdfundContractClient};

// ── Shared helper ─────────────────────────────────────────────────────────────

fn setup(env: &Env, deadline: u64, goal: i128, min: i128) -> (Address, Address, CrowdfundContractClient) {
    let creator = Address::generate(env);
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min,
        &String::from_str(env, "T"),
        &String::from_str(env, "D"),
        &None,
        &None,
        &None,
    );
    (creator, token_id, client)
}

// ── Existing tests ────────────────────────────────────────────────────────────

#[test]
fn test_cancel_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline = 1000u64;

    client.initialize(
        &creator, &token_id, &10000, &deadline, &100,
        &String::from_str(&env, "My Title"),
        &String::from_str(&env, "My Description"),
        &None, &None, &None,
    );

    let user1 = Address::generate(&env);
    token_admin_client.mint(&user1, &500);
    client.contribute(&user1, &500, &token_id);
    assert_eq!(client.total_raised(), 500);

    client.cancel_campaign();

    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "cancelled").into_val(&env);
    events.iter().find(|e| e.1 == topics).expect("cancelled event not found");

    assert_eq!(client.social_links().len(), 0);

    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    token_admin_client.mint(&user1, &100);
    let result = client.try_contribute(&user1, &100, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    env.ledger().set_timestamp(deadline - 10);
    client.refund_single(&user1);
    assert_eq!(token.balance(&user1), 500 + 100);
    assert_eq!(client.contribution(&user1), 0);
}

#[test]
fn test_cancel_already_cancelled() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let mut links = Vec::new(&env);
    links.push_back(String::from_str(&env, "https://example.com"));

    client.initialize(
        &creator, &token_id, &1000, &1000, &10,
        &String::from_str(&env, "My Title"),
        &String::from_str(&env, "My Description"),
        &Some(links), &None, &None,
    );
    client.cancel_campaign();

    let result = client.try_cancel_campaign();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    let stored_links = client.social_links();
    assert_eq!(stored_links.len(), 1);
    assert_eq!(stored_links.get(0).unwrap(), String::from_str(&env, "https://example.com"));
}

#[test]
fn test_update_metadata() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator, &token_id, &1000, &1000, &10,
        &String::from_str(&env, "Old Title"),
        &String::from_str(&env, "Old Description"),
        &None, &None, &None,
    );

    let mut new_links = Vec::new(&env);
    new_links.push_back(String::from_str(&env, "https://new.com"));

    client.update_metadata(
        &Some(String::from_str(&env, "New Title")),
        &Some(String::from_str(&env, "New Description")),
        &Some(new_links),
    );

    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "metadata_updated").into_val(&env);
    assert!(events.iter().any(|e| e.1 == topics), "metadata_updated event not found");

    assert_eq!(client.title(), String::from_str(&env, "New Title"));
    assert_eq!(client.description(), String::from_str(&env, "New Description"));
    assert_eq!(client.social_links().get(0).unwrap(), String::from_str(&env, "https://new.com"));

    client.cancel_campaign();
    let result = client.try_update_metadata(&None, &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}

#[test]
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );
    let result = client.try_initialize(
        &creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::AlreadyInitialized)));
}

#[test]
fn test_contribute_after_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let (_, token_id, client) = setup(&env, deadline, 5000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_contribute(&user, &100, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignEnded)));
}

#[test]
fn test_contribute_below_minimum() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, token_id, client) = setup(&env, 9999, 5000, 100);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &50);

    let result = client.try_contribute(&user, &50, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::BelowMinimum)));
}

#[test]
fn test_withdraw_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 9999u64;
    let (_, token_id, client) = setup(&env, deadline, 100, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &200);
    client.contribute(&user, &200, &token_id);

    env.ledger().set_timestamp(deadline - 1);
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn test_withdraw_goal_not_met() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let (_, token_id, client) = setup(&env, deadline, 10_000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    client.contribute(&user, &100, &token_id);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::GoalNotReached)));
}

#[test]
fn test_refund_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 9999u64;
    let (_, token_id, client) = setup(&env, deadline, 10_000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    client.contribute(&user, &100, &token_id);

    env.ledger().set_timestamp(deadline - 1);
    let result = client.try_refund_single(&user);
    assert_eq!(result.err(), Some(Ok(ContractError::CampaignStillActive)));
}

#[test]
fn test_refund_when_goal_met() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let goal = 500i128;
    let (_, token_id, client) = setup(&env, deadline, goal, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &goal);
    client.contribute(&user, &goal, &token_id);

    env.ledger().set_timestamp(deadline + 1);
    let result = client.try_refund_single(&user);
    assert_eq!(result.err(), Some(Ok(ContractError::GoalReached)));
}

#[test]
fn test_overflow_on_total_raised() {
    let env = Env::default();
    env.mock_all_auths();
    // Use amounts that fit in the token contract but overflow i128 when summed.
    // We seed total_raised by writing directly to storage, then attempt one more contribution.
    let large: i128 = i128::MAX - 50;
    let (_, token_id, client) = setup(&env, 9999, i128::MAX, 1);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Seed total_raised directly — bypasses token transfer limits
    env.as_contract(&client.address, || {
        env.storage().instance().set(&KEY_TOTAL, &large);
    });

    // A contribution of 100 would push total past i128::MAX
    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    let result = client.try_contribute(&user, &100, &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::Overflow)));
}

#[test]
fn test_invalid_platform_fee() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let bad_config = PlatformConfig {
        address: Address::generate(&env),
        fee_bps: 10_001,
    };
    let result = client.try_initialize(
        &creator, &token_id, &1000, &9999, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &Some(bad_config), &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidFee)));
}

#[test]
fn test_initialize_invalid_goal() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let client = CrowdfundContractClient::new(&env, &env.register_contract(None, CrowdfundContract));

    env.ledger().set_timestamp(100);
    let result = client.try_initialize(
        &creator, &token_id, &0, &200, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidGoal)));
}

#[test]
fn test_initialize_invalid_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let client = CrowdfundContractClient::new(&env, &env.register_contract(None, CrowdfundContract));

    env.ledger().set_timestamp(500);
    let result = client.try_initialize(
        &creator, &token_id, &1000, &500, &10,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::InvalidDeadline)));
}

#[test]
fn test_initialize_invalid_min_contribution() {
    let env = Env::default();
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(Address::generate(&env));
    let client = CrowdfundContractClient::new(&env, &env.register_contract(None, CrowdfundContract));

    env.ledger().set_timestamp(100);
    let result = client.try_initialize(
        &creator, &token_id, &1000, &200, &-1,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );
    assert_eq!(result.err(), Some(Ok(ContractError::BelowMinimum)));
}

#[test]
fn test_full_campaign_lifecycle_success() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline = 1000u64;
    let goal = 10_000i128;

    client.initialize(
        &creator, &token_id, &goal, &deadline, &100,
        &String::from_str(&env, "Save the Whales"),
        &String::from_str(&env, "Help us protect marine life"),
        &None, &None, &None,
    );

    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);
    let contributor3 = Address::generate(&env);

    token_admin_client.mint(&contributor1, &3_000);
    token_admin_client.mint(&contributor2, &4_000);
    token_admin_client.mint(&contributor3, &3_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &3_000, &token_id);
    client.contribute(&contributor2, &4_000, &token_id);
    client.contribute(&contributor3, &3_000, &token_id);

    assert_eq!(client.total_raised(), 10_000);

    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 10_000);
    assert_eq!(stats.progress_bps, 10_000);
    assert_eq!(stats.contributor_count, 3);
    assert_eq!(stats.largest_contribution, 4_000);

    env.ledger().set_timestamp(deadline + 1);
    token_admin_client.mint(&creator, &1_000);
    let creator_initial_balance = token.balance(&creator);

    client.withdraw();

    assert_eq!(client.total_raised(), 0);
    assert_eq!(token.balance(&creator), creator_initial_balance + 10_000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_platform_fee_deduction() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let platform_address = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let platform_config = PlatformConfig { address: platform_address.clone(), fee_bps: 500 };

    client.initialize(
        &creator, &token_id, &10_000, &1000, &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None, &Some(platform_config), &None,
    );

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &10_000);
    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &10_000, &token_id);

    env.ledger().set_timestamp(1001);
    let creator_before = token.balance(&creator);
    let platform_before = token.balance(&platform_address);

    client.withdraw();

    assert_eq!(token.balance(&creator), creator_before + 9_500);
    assert_eq!(token.balance(&platform_address), platform_before + 500);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_refund_after_missed_goal() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator, &token_id, &10_000, &1000, &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None, &None, &None,
    );

    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);

    token_admin_client.mint(&contributor1, &2_000);
    token_admin_client.mint(&contributor2, &3_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &2_000, &token_id);
    client.contribute(&contributor2, &3_000, &token_id);

    env.ledger().set_timestamp(1001);
    assert_eq!(client.try_withdraw().err(), Some(Ok(ContractError::GoalNotReached)));

    let b1 = token.balance(&contributor1);
    let b2 = token.balance(&contributor2);
    client.refund_single(&contributor1);
    client.refund_single(&contributor2);
    assert_eq!(token.balance(&contributor1), b1 + 2_000);
    assert_eq!(token.balance(&contributor2), b2 + 3_000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_no_whitelist_rejects_non_default_token() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_a_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_b_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_b_admin = token::StellarAssetClient::new(&env, &token_b_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator, &token_a_id, &1000, &1000, &1,
        &String::from_str(&env, "T"), &String::from_str(&env, "D"),
        &None, &None, &None,
    );

    let user = Address::generate(&env);
    token_b_admin.mint(&user, &100);
    let result = client.try_contribute(&user, &100, &token_b_id);
    assert_eq!(result.err(), Some(Ok(ContractError::TokenNotAccepted)));
}

// ── Boundary tests (#107) ─────────────────────────────────────────────────────

/// Contribute exactly min_contribution — must succeed.
#[test]
fn test_boundary_exact_minimum_contribution() {
    let env = Env::default();
    env.mock_all_auths();
    let min = 100i128;
    let (_, token_id, client) = setup(&env, 9999, 10_000, min);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &min);

    let result = client.try_contribute(&user, &min, &token_id);
    assert!(result.is_ok(), "exact min_contribution must succeed");
    assert_eq!(client.total_raised(), min);
}

/// Contribute min_contribution - 1 — must return BelowMinimum.
#[test]
fn test_boundary_under_minimum_contribution() {
    let env = Env::default();
    env.mock_all_auths();
    let min = 100i128;
    let (_, token_id, client) = setup(&env, 9999, 10_000, min);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &(min - 1));

    let result = client.try_contribute(&user, &(min - 1), &token_id);
    assert_eq!(result.err(), Some(Ok(ContractError::BelowMinimum)));
}

/// Push total_raised past i128::MAX — must return Overflow, not panic.
/// We seed total_raised directly in storage to bypass token transfer limits,
/// then attempt a small contribution that would push the sum past i128::MAX.
#[test]
fn test_boundary_i128_overflow_on_total() {
    let env = Env::default();
    env.mock_all_auths();
    let large: i128 = i128::MAX - 50;
    let (_, token_id, client) = setup(&env, 9999, i128::MAX, 1);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Seed total_raised directly — bypasses token transfer limits
    env.as_contract(&client.address, || {
        env.storage().instance().set(&KEY_TOTAL, &large);
    });

    // A contribution of 100 would push total past i128::MAX
    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);
    let result = client.try_contribute(&user, &100, &token_id);
    assert_eq!(
        result.err(),
        Some(Ok(ContractError::Overflow)),
        "overflow must be caught as ContractError::Overflow, not a panic"
    );
}

/// Campaign with goal = i128::MAX — a normal contribution must not panic.
#[test]
fn test_boundary_max_goal_stability() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, token_id, client) = setup(&env, 9999, i128::MAX, 1);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &1_000);

    // Standard contribution against a max-goal campaign — must not panic
    let result = client.try_contribute(&user, &1_000, &token_id);
    assert!(result.is_ok(), "contribution against i128::MAX goal must succeed");
    assert_eq!(client.total_raised(), 1_000);

    // Progress should be effectively 0% (1000 / i128::MAX rounds to 0 bps)
    let stats = client.get_stats();
    assert_eq!(stats.progress_bps, 0);
}

/// Contribute at exactly the deadline timestamp — must return CampaignEnded.
#[test]
fn test_boundary_contribute_at_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let deadline = 1000u64;
    let (_, token_id, client) = setup(&env, deadline, 5_000, 10);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_admin_client.mint(&user, &100);

    // Set ledger timestamp == deadline (boundary: deadline is no longer open)
    env.ledger().set_timestamp(deadline);
    let result = client.try_contribute(&user, &100, &token_id);
    assert_eq!(
        result.err(),
        Some(Ok(ContractError::CampaignEnded)),
        "contribution at exactly the deadline must fail"
    );
}
