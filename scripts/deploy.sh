#!/usr/bin/env bash
# Deploy Fund-My-Cause crowdfund contract to Stellar network
# Usage: ./scripts/deploy.sh [OPTIONS] <creator> <token> <goal> <deadline>

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK="testnet"
MIN_CONTRIBUTION=1
TITLE="Default Title"
DESCRIPTION="Default Description"
SOCIAL_LINKS="null"
REGISTRY_ID="${REGISTRY_ID:-}"

# Parse command-line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --min-contribution)
      MIN_CONTRIBUTION="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --description)
      DESCRIPTION="$2"
      shift 2
      ;;
    --social-links)
      SOCIAL_LINKS="$2"
      shift 2
      ;;
    --registry-id)
      REGISTRY_ID="$2"
      shift 2
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    -*)
      echo -e "${RED}Error: Unknown option: $1${NC}" >&2
      print_usage
      exit 1
      ;;
    *)
      break
      ;;
  esac
done

# Remaining positional arguments
CREATOR="${1:-}"
TOKEN="${2:-}"
GOAL="${3:-}"
DEADLINE="${4:-}"

# Function to print usage
print_usage() {
  cat << EOF
${BLUE}Usage: ./scripts/deploy.sh [OPTIONS] <creator> <token> <goal> <deadline>${NC}

${BLUE}Required Arguments:${NC}
  creator               Your Stellar account address
  token                 Token contract ID to accept for contributions
  goal                  Campaign goal in stroops
  deadline              Campaign deadline (Unix timestamp)

${BLUE}Optional Arguments:${NC}
  --network NETWORK              Network to deploy to (default: testnet)
  --min-contribution AMOUNT      Minimum contribution amount (default: 1)
  --title TITLE                  Campaign title (default: "Default Title")
  --description DESC             Campaign description (default: "Default Description")
  --social-links JSON            Social links as JSON object (default: null)
  --registry-id REGISTRY_ID      Existing registry contract ID
  --help                         Show this help message

${BLUE}Examples:${NC}
  # Deploy to testnet with required parameters
  ./scripts/deploy.sh GBBD47UZQ2QDAAK63XUIFH5FXVLNFSMQC4MLR4LHPWKFG7FMKGV2FI2QI \\
    CAQCBGVLWCSMNRMQ4ZBVWWV5CSTW2UNKHJ42OU7CW7ADgnboraeoSol \\
    10000000000 1735689600

  # Deploy to mainnet with custom parameters
  ./scripts/deploy.sh --network mainnet --title "My Campaign" \\
    GBUQWP3BOUZX34ULNQG23RQ6F4OSG3GSRVF4H27YSWBUMPY5PEW5HMZV \\
    CAQCBGVLWCSMNRMQ4ZBVWWV5CSTW2UNKHJ42OU7CW7ADGNBORAEOSON \\
    50000000000 1767225600
EOF
}

# Validate required arguments
if [ -z "$CREATOR" ] || [ -z "$TOKEN" ] || [ -z "$GOAL" ] || [ -z "$DEADLINE" ]; then
  echo -e "${RED}Error: Missing required arguments${NC}" >&2
  print_usage
  exit 1
fi

# Validate network parameter
if [[ ! "$NETWORK" =~ ^(testnet|mainnet|custom)$ ]]; then
  echo -e "${RED}Error: Invalid network '$NETWORK'. Must be: testnet, mainnet, or custom${NC}" >&2
  exit 1
fi

# Helper function for colored output
log_info() {
  echo -e "${BLUE}➜${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Main deployment logic
log_info "Starting deployment to $NETWORK network..."
log_info "Creator: $CREATOR"
log_info "Token: $TOKEN"
log_info "Goal: $GOAL stroops"
log_info "Deadline: $DEADLINE"

log_info "Building WASM artifacts..."
if ! cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml 2>&1 | tail -5; then
  log_error "Failed to build crowdfund contract"
  exit 1
fi
log_success "Crowdfund contract built"

if ! cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/registry/Cargo.toml 2>&1 | tail -5; then
  log_error "Failed to build registry contract"
  exit 1
fi
log_success "Registry contract built"

# Deploy or use existing registry
if [ -z "$REGISTRY_ID" ]; then
  log_info "Deploying registry contract..."
  REGISTRY_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/registry.optimized.wasm \
    --network "$NETWORK" \
    --source "$CREATOR")
  
  if [ -z "$REGISTRY_ID" ]; then
    log_error "Failed to deploy registry contract"
    exit 1
  fi
  log_success "Registry deployed: $REGISTRY_ID"
else
  log_info "Using existing registry: $REGISTRY_ID"
fi

# Deploy crowdfund contract
log_info "Deploying crowdfund contract to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crowdfund.optimized.wasm \
  --network "$NETWORK" \
  --source "$CREATOR")

if [ -z "$CONTRACT_ID" ]; then
  log_error "Failed to deploy crowdfund contract"
  exit 1
fi
log_success "Crowdfund contract deployed: $CONTRACT_ID"

# Initialize campaign
log_info "Initializing campaign..."
if ! stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
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
  --platform_config null > /dev/null 2>&1; then
  log_error "Failed to initialize campaign"
  exit 1
fi
log_success "Campaign initialized"

# Register campaign in registry
log_info "Registering campaign in registry..."
if ! stellar contract invoke \
  --id "$REGISTRY_ID" \
  --network "$NETWORK" \
  --source "$CREATOR" \
  -- register \
  --campaign_id "$CONTRACT_ID" > /dev/null 2>&1; then
  log_error "Failed to register campaign in registry"
  exit 1
fi
log_success "Campaign registered in registry"

# Save contract ID to .env.local
ENV_FILE="apps/interface/.env.local"
log_info "Saving configuration to $ENV_FILE..."

# Create or update .env.local file
{
  echo "# Auto-generated by deploy.sh - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
  echo "NEXT_PUBLIC_REGISTRY_ID=$REGISTRY_ID"
  echo "NEXT_PUBLIC_NETWORK=$NETWORK"
} > "$ENV_FILE"

log_success "Configuration saved to $ENV_FILE"

# Print summary table
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                    ${GREEN}DEPLOYMENT SUCCESSFUL${NC}                      ${BLUE}║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Network:            ${GREEN}$NETWORK${NC}"
echo -e "${BLUE}║${NC} Creator:            ${GREEN}$CREATOR${NC}"
echo -e "${BLUE}║${NC} Token:              ${GREEN}$TOKEN${NC}"
echo -e "${BLUE}║${NC} Goal:               ${GREEN}$GOAL stroops${NC}"
echo -e "${BLUE}║${NC} Deadline:           ${GREEN}$DEADLINE${NC}"
echo -e "${BLUE}║${NC} Crowdfund ID:       ${GREEN}$CONTRACT_ID${NC}"
echo -e "${BLUE}║${NC} Registry ID:        ${GREEN}$REGISTRY_ID${NC}"
echo -e "${BLUE}║${NC} Config File:        ${GREEN}$ENV_FILE${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_success "Ready to use! Environment variables have been saved."
