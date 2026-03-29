#!/usr/bin/env bash
# Deploy Fund-My-Cause crowdfund contract to Stellar testnet
# Usage: ./scripts/deploy.sh <creator> <token> <goal> <deadline> <min_contribution> <title> <description> <social_links> [registry_contract_id]

set -e

CREATOR=$1
TOKEN=$2
GOAL=$3
DEADLINE=$4
MIN_CONTRIBUTION=${5:-1}
TITLE=${6:-"Default Title"}
DESCRIPTION=${7:-"Default Description"}
SOCIAL_LINKS=${8:-"null"}
REGISTRY_ID=${9:-${REGISTRY_ID:-}}

echo "Building WASM artifacts..."
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/registry/Cargo.toml

if [ -z "$REGISTRY_ID" ]; then
  echo "No registry ID provided. Deploying registry contract..."
  REGISTRY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/registry.optimized.wasm \
    --network testnet \
    --source "$CREATOR")
  echo "Registry deployed: $REGISTRY_ID"
else
  echo "Using existing registry: $REGISTRY_ID"
fi

echo "Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crowdfund.optimized.wasm
  --network testnet \
  --source "$CREATOR")

echo "Contract deployed: $CONTRACT_ID"

echo "Initializing campaign..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source "$CREATOR" \
  -- initialize \
  --creator "$CREATOR" \
  --token "$TOKEN" \
  --goal "$GOAL" \
  --deadline "$DEADLINE" \
  --min_contribution "$MIN_CONTRIBUTION" \
  --title "$TITLE" \
  --description "$DESCRIPTION" \
  --social_links "$SOCIAL_LINKS" \
  --platform_config null

echo "Registering campaign in registry..."
stellar contract invoke \
  --id "$REGISTRY_ID" \
  --network testnet \
  --source "$CREATOR" \
  -- register \
  --campaign_id "$CONTRACT_ID"

echo "Campaign initialized successfully."
echo "Contract ID: $CONTRACT_ID"
echo "Registry ID: $REGISTRY_ID"
echo "Save these IDs for frontend discovery and interaction."
