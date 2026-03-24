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
