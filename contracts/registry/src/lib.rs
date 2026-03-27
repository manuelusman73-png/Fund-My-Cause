#![no_std]
#![allow(missing_docs)]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol, Vec};

const KEY_CAMPAIGNS: Symbol = symbol_short!("CMPLIST");

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// Register a campaign contract ID if it is not already present.
    pub fn register(env: Env, campaign_id: Address) {
        let mut campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        if !campaigns.contains(&campaign_id) {
            campaigns.push_back(campaign_id.clone());
            env.storage().instance().set(&KEY_CAMPAIGNS, &campaigns);
            env.events().publish(("registry", "registered"), campaign_id);
        }
    }

    /// Return a paginated slice of registered campaign IDs.
    pub fn list(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        if limit == 0 {
            return Vec::new(&env);
        }

        let campaigns: Vec<Address> = env
            .storage()
            .instance()
            .get(&KEY_CAMPAIGNS)
            .unwrap_or_else(|| Vec::new(&env));

        let total = campaigns.len();
        if offset >= total {
            return Vec::new(&env);
        }

        let end = offset.saturating_add(limit).min(total);
        let mut out = Vec::new(&env);

        let mut i = offset;
        while i < end {
            if let Some(addr) = campaigns.get(i) {
                out.push_back(addr);
            }
            i += 1;
        }

        out
    }
}

#[cfg(test)]
#[allow(deprecated)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address};

    #[test]
    fn register_deduplicates_and_lists_with_pagination() {
        let env = Env::default();

        let registry_id = env.register_contract(None, RegistryContract);
        let client = RegistryContractClient::new(&env, &registry_id);

        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let c = Address::generate(&env);

        client.register(&a);
        client.register(&b);
        client.register(&a);
        client.register(&c);

        let first_two = client.list(&0, &2);
        assert_eq!(first_two.len(), 2);
        assert_eq!(first_two.get(0), Some(a.clone()));
        assert_eq!(first_two.get(1), Some(b.clone()));

        let next_two = client.list(&2, &2);
        assert_eq!(next_two.len(), 1);
        assert_eq!(next_two.get(0), Some(c));

        let empty = client.list(&99, &10);
        assert_eq!(empty.len(), 0);
    }
}
