#!/usr/bin/env bash
# Deploy Fund-My-Cause crowdfund contract to Stellar testnet
# Usage: ./scripts/deploy.sh <creator> <token> <goal> <deadline> <min_contribution> <title> <description> <social_links>

set -e

CREATOR=$1
TOKEN=$2
GOAL=$3
DEADLINE=$4
MIN_CONTRIBUTION=${5:-1}
TITLE=${6:-"Default Title"}
DESCRIPTION=${7:-"Default Description"}
SOCIAL_LINKS=${8:-"null"}

echo "Building WASM..."
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml

echo "Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
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

echo "Campaign initialized successfully."
echo "Contract ID: $CONTRACT_ID"
echo "Save this Contract ID for interacting with the campaign."
