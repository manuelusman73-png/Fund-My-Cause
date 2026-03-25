#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Events, Ledger}, Address, Env, IntoVal, Val, Vec};
use crate::{CrowdfundContract, CrowdfundContractClient};

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

    let deadline = 1000;
    let goal = 10000;
    let min_contribution = 100;

    client.initialize(&creator, &token_id, &goal, &deadline, &min_contribution, &String::from_str(&env, "My Title"), &String::from_str(&env, "My Description"), &None, &None);

    // Some contributions
    let user1 = Address::generate(&env);
    token_admin_client.mint(&user1, &500);
    client.contribute(&user1, &500);

    assert_eq!(client.total_raised(), 500);

    // Cancel campaign
    client.cancel_campaign();

    // Verify event
    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "cancelled").into_val(&env);
    let _cancelled_event = events.iter().find(|e| e.1 == topics).expect("cancelled event not found");

    // Verify social_links are empty
    assert_eq!(client.social_links().len(), 0);

    // Verify withdrawing fails
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Verify contributing fails after cancel
    token_admin_client.mint(&user1, &100);
    let result = client.try_contribute(&user1, &100);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Refund should work now even before deadline
    env.ledger().set_timestamp(deadline - 10);
    client.refund_single(&user1);
    
    assert_eq!(token.balance(&user1), 500 + 100); // 500 returned + 100 new mint
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
    
    client.initialize(&creator, &token_id, &1000, &1000, &10, &String::from_str(&env, "My Title"), &String::from_str(&env, "My Description"), &Some(links), &None);
    client.cancel_campaign();

    let result = client.try_cancel_campaign();
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));

    // Verify social_links are populated
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

    client.initialize(&creator, &token_id, &1000, &1000, &10, &String::from_str(&env, "Old Title"), &String::from_str(&env, "Old Description"), &None, &None);

    let mut new_links = Vec::new(&env);
    new_links.push_back(String::from_str(&env, "https://new.com"));

    client.update_metadata(
        &Some(String::from_str(&env, "New Title")),
        &Some(String::from_str(&env, "New Description")),
        &Some(new_links),
    );

    // Verify event
    let events = env.events().all();
    let topics: Vec<Val> = ("campaign", "metadata_updated").into_val(&env);
    if !events.iter().any(|e| e.1 == topics) {
        panic!("metadata_updated event not found. Total events: {}", events.len());
    }

    assert_eq!(client.title(), String::from_str(&env, "New Title"));
    assert_eq!(client.description(), String::from_str(&env, "New Description"));
    
    let stored_links = client.social_links();
    assert_eq!(stored_links.len(), 1);
    assert_eq!(stored_links.get(0).unwrap(), String::from_str(&env, "https://new.com"));

    // Cancel and ensure update fails
    client.cancel_campaign();
    let result = client.try_update_metadata(&None, &None, &None);
    assert_eq!(result.err(), Some(Ok(ContractError::NotActive)));
}

#[test]
fn test_is_contributor() {
// ══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE HAPPY PATH TEST SUITE
// ══════════════════════════════════════════════════════════════════════════════

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

    let goal = 10_000i128;
    let deadline = 2000u64;
    let min_contribution = 100i128;

    // Initialize campaign
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min_contribution,
        &String::from_str(&env, "Save the Whales"),
        &String::from_str(&env, "Help us protect marine life"),
        &None,
        &None,
    );

    // Verify initial state
    assert_eq!(client.total_raised(), 0);
    assert_eq!(client.goal(), goal);
    assert_eq!(client.deadline(), deadline);
    assert_eq!(client.min_contribution(), min_contribution);

    // Multiple contributors
    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);
    let contributor3 = Address::generate(&env);

    // Mint tokens and contribute
    token_admin_client.mint(&contributor1, &3_000);
    token_admin_client.mint(&contributor2, &4_000);
    token_admin_client.mint(&contributor3, &3_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &3_000);
    client.contribute(&contributor2, &4_000);
    client.contribute(&contributor3, &3_000);

    // Verify contributions
    assert_eq!(client.total_raised(), 10_000);
    assert_eq!(client.contribution(&contributor1), 3_000);
    assert_eq!(client.contribution(&contributor2), 4_000);
    assert_eq!(client.contribution(&contributor3), 3_000);

    // Verify stats
    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 10_000);
    assert_eq!(stats.goal, 10_000);
    assert_eq!(stats.progress_bps, 10_000); // 100%
    assert_eq!(stats.contributor_count, 3);
    assert_eq!(stats.average_contribution, 3_333); // 10000/3
    assert_eq!(stats.largest_contribution, 4_000);

    // Move past deadline
    env.ledger().set_timestamp(deadline + 1);

    // Mint tokens to creator for initial balance check
    token_admin_client.mint(&creator, &1_000);
    let creator_initial_balance = token.balance(&creator);

    // Withdraw funds
    client.withdraw();

    // Verify withdrawal
    assert_eq!(client.total_raised(), 0);
    assert_eq!(token.balance(&creator), creator_initial_balance + 10_000);
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_multiple_contributions_same_user() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &5_000,
        &1000,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &None,
    );

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &5_000);

    // Multiple contributions from same user
    env.ledger().set_timestamp(100);
    client.contribute(&contributor, &1_000);
    assert_eq!(client.contribution(&contributor), 1_000);
    assert_eq!(client.total_raised(), 1_000);

    client.contribute(&contributor, &2_000);
    assert_eq!(client.contribution(&contributor), 3_000);
    assert_eq!(client.total_raised(), 3_000);

    client.contribute(&contributor, &2_000);
    assert_eq!(client.contribution(&contributor), 5_000);
    assert_eq!(client.total_raised(), 5_000);

    // Verify stats show only 1 contributor
    let stats = client.get_stats();
    assert_eq!(stats.contributor_count, 1);
    assert_eq!(stats.average_contribution, 5_000);
    assert_eq!(stats.largest_contribution, 5_000);
}

#[test]
fn test_exact_goal_hit() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let goal = 7_777i128;
    let deadline = 1000u64;

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &None,
    );

    // Contribute exactly the goal amount
    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);

    token_admin_client.mint(&contributor1, &5_000);
    token_admin_client.mint(&contributor2, &2_777);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &5_000);
    client.contribute(&contributor2, &2_777);

    // Verify exact goal hit
    assert_eq!(client.total_raised(), goal);

    let stats = client.get_stats();
    assert_eq!(stats.progress_bps, 10_000); // Exactly 100%

    // Move past deadline and withdraw
    env.ledger().set_timestamp(deadline + 1);
    
    let creator_balance_before = token.balance(&creator);
    client.withdraw();
    
    assert_eq!(token.balance(&creator), creator_balance_before + goal);
}

#[test]
fn test_platform_fee_deduction() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let platform_address = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let deadline = 1000;
    let goal = 10000;
    let min_contribution = 100;

    client.initialize(&creator, &token_id, &goal, &deadline, &min_contribution, &String::from_str(&env, "My Title"), &String::from_str(&env, "My Description"), &None, &None);

    // Test non-contributor
    let non_contributor = Address::generate(&env);
    assert_eq!(client.is_contributor(&non_contributor), false);

    // Test contributor
    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &500);
    client.contribute(&contributor, &500);
    assert_eq!(client.is_contributor(&contributor), true);

    // Test after refund
    client.cancel_campaign();
    client.refund_single(&contributor);
    assert_eq!(client.is_contributor(&contributor), false);
    let goal = 10_000i128;
    let deadline = 1000u64;
    let fee_bps = 500u32; // 5% fee

    let platform_config = PlatformConfig {
        address: platform_address.clone(),
        fee_bps,
    };

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &Some(platform_config),
    );

    // Contribute to reach goal
    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &10_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &10_000);

    assert_eq!(client.total_raised(), 10_000);

    // Move past deadline and withdraw
    env.ledger().set_timestamp(deadline + 1);

    let creator_balance_before = token.balance(&creator);
    let platform_balance_before = token.balance(&platform_address);

    client.withdraw();

    // Calculate expected amounts
    let fee = 10_000 * 500 / 10_000; // 500 (5%)
    let creator_payout = 10_000 - fee; // 9,500

    assert_eq!(token.balance(&creator), creator_balance_before + creator_payout);
    assert_eq!(token.balance(&platform_address), platform_balance_before + fee);
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

    let goal = 10_000i128;
    let deadline = 1000u64;

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &None,
    );

    // Contributors don't reach goal
    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);
    let contributor3 = Address::generate(&env);

    token_admin_client.mint(&contributor1, &2_000);
    token_admin_client.mint(&contributor2, &3_000);
    token_admin_client.mint(&contributor3, &1_500);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &2_000);
    client.contribute(&contributor2, &3_000);
    client.contribute(&contributor3, &1_500);

    assert_eq!(client.total_raised(), 6_500); // Less than goal

    // Move past deadline
    env.ledger().set_timestamp(deadline + 1);

    // Verify withdrawal fails
    let result = client.try_withdraw();
    assert_eq!(result.err(), Some(Ok(ContractError::GoalNotReached)));

    // Each contributor gets refund
    let balance1_before = token.balance(&contributor1);
    let balance2_before = token.balance(&contributor2);
    let balance3_before = token.balance(&contributor3);

    client.refund_single(&contributor1);
    client.refund_single(&contributor2);
    client.refund_single(&contributor3);

    assert_eq!(token.balance(&contributor1), balance1_before + 2_000);
    assert_eq!(token.balance(&contributor2), balance2_before + 3_000);
    assert_eq!(token.balance(&contributor3), balance3_before + 1_500);

    // Verify contributions are zeroed
    assert_eq!(client.contribution(&contributor1), 0);
    assert_eq!(client.contribution(&contributor2), 0);
    assert_eq!(client.contribution(&contributor3), 0);

    // Contract should be empty
    assert_eq!(token.balance(&contract_id), 0);
}

#[test]
fn test_all_view_functions() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let platform_address = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let goal = 5_000i128;
    let deadline = 2000u64;
    let min_contribution = 50i128;
    let title = String::from_str(&env, "Test Campaign");
    let description = String::from_str(&env, "This is a test");

    let mut social_links = Vec::new(&env);
    social_links.push_back(String::from_str(&env, "https://twitter.com/test"));
    social_links.push_back(String::from_str(&env, "https://github.com/test"));

    let platform_config = PlatformConfig {
        address: platform_address.clone(),
        fee_bps: 250, // 2.5%
    };

    // Initialize
    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &min_contribution,
        &title,
        &description,
        &Some(social_links.clone()),
        &Some(platform_config.clone()),
    );

    // Test all view functions
    assert_eq!(client.goal(), goal);
    assert_eq!(client.deadline(), deadline);
    assert_eq!(client.min_contribution(), min_contribution);
    assert_eq!(client.title(), title);
    assert_eq!(client.description(), description);
    assert_eq!(client.total_raised(), 0);
    assert_eq!(client.version(), 3);

    // Test social links
    let retrieved_links = client.social_links();
    assert_eq!(retrieved_links.len(), 2);
    assert_eq!(retrieved_links.get(0).unwrap(), String::from_str(&env, "https://twitter.com/test"));
    assert_eq!(retrieved_links.get(1).unwrap(), String::from_str(&env, "https://github.com/test"));

    // Add contributions and test contribution view
    let contributor1 = Address::generate(&env);
    let contributor2 = Address::generate(&env);

    token_admin_client.mint(&contributor1, &1_000);
    token_admin_client.mint(&contributor2, &2_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor1, &1_000);
    client.contribute(&contributor2, &2_000);

    assert_eq!(client.contribution(&contributor1), 1_000);
    assert_eq!(client.contribution(&contributor2), 2_000);
    assert_eq!(client.total_raised(), 3_000);

    // Test get_stats
    let stats = client.get_stats();
    assert_eq!(stats.total_raised, 3_000);
    assert_eq!(stats.goal, 5_000);
    assert_eq!(stats.progress_bps, 6_000); // 60%
    assert_eq!(stats.contributor_count, 2);
    assert_eq!(stats.average_contribution, 1_500);
    assert_eq!(stats.largest_contribution, 2_000);
}

#[test]
fn test_over_goal_contribution() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    let goal = 5_000i128;
    let deadline = 1000u64;

    client.initialize(
        &creator,
        &token_id,
        &goal,
        &deadline,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &None,
    );

    // Contribute more than goal
    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &8_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &8_000);

    assert_eq!(client.total_raised(), 8_000);

    // Progress should cap at 100%
    let stats = client.get_stats();
    assert_eq!(stats.progress_bps, 10_000); // Capped at 100%

    // Move past deadline and withdraw
    env.ledger().set_timestamp(deadline + 1);

    let creator_balance_before = token.balance(&creator);
    client.withdraw();

    // Creator gets full amount raised (over goal)
    assert_eq!(token.balance(&creator), creator_balance_before + 8_000);
}

#[test]
fn test_campaign_with_events() {
    let env = Env::default();
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CrowdfundContract);
    let client = CrowdfundContractClient::new(&env, &contract_id);

    client.initialize(
        &creator,
        &token_id,
        &5_000,
        &1000,
        &100,
        &String::from_str(&env, "Title"),
        &String::from_str(&env, "Description"),
        &None,
        &None,
    );

    let contributor = Address::generate(&env);
    token_admin_client.mint(&contributor, &5_000);

    env.ledger().set_timestamp(500);
    client.contribute(&contributor, &5_000);

    // Verify contribution event
    let events = env.events().all();
    let contribute_topics: Vec<Val> = ("campaign", "contributed").into_val(&env);
    let contribute_event = events.iter().find(|e| e.1 == contribute_topics);
    assert!(contribute_event.is_some(), "contributed event not found");

    // Move past deadline and withdraw
    env.ledger().set_timestamp(1001);
    client.withdraw();

    // Verify withdrawal event
    let events = env.events().all();
    let withdraw_topics: Vec<Val> = ("campaign", "withdrawn").into_val(&env);
    let withdraw_event = events.iter().find(|e| e.1 == withdraw_topics);
    assert!(withdraw_event.is_some(), "withdrawn event not found");
}
