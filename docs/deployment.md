# Mainnet Deployment Guide

Complete step-by-step guide for deploying Fund-My-Cause to the Stellar mainnet.

## Prerequisites

Before deploying to mainnet, ensure you have:

1. **Stellar CLI** installed
   ```bash
   # Install or update Stellar CLI
   curl https://stellar.org/install-cli | bash
   ```

2. **Rust toolchain** with Soroban target
   ```bash
   rustup update
   rustup target add wasm32-unknown-unknown
   ```

3. **Node.js 18+** for frontend deployment

4. **Mainnet account** with sufficient XLM for deployment fees
   - Minimum: 10 XLM (for contract deployment + initialization)
   - Recommended: 50 XLM (for testing + buffer)

5. **Freighter wallet** with mainnet access

6. **GitHub account** for code verification

## Step 1: Prepare Deployment Account

### 1.1 Create or Use Existing Account

If you don't have a mainnet account:

```bash
# Generate a new keypair
stellar keys generate --network public

# Save the public key and secret key securely
# Store secret key in a secure location (hardware wallet, encrypted file, etc.)
```

### 1.2 Fund the Account

Send at least 10 XLM to your deployment account from an exchange or existing account.

```bash
# Check account balance
stellar account info <YOUR_PUBLIC_KEY> --network public
```

### 1.3 Set Environment Variables

```bash
# Create .env.mainnet file
cat > .env.mainnet << 'EOF'
# Deployment account
DEPLOYER_PUBLIC_KEY="<your-public-key>"
DEPLOYER_SECRET_KEY="<your-secret-key>"

# Mainnet configuration
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
RPC_URL="https://soroban-mainnet.stellar.org"
HORIZON_URL="https://horizon.stellar.org"

# Campaign parameters
CREATOR_ADDRESS="<creator-public-key>"
TOKEN_ADDRESS="CAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4"  # Native XLM
GOAL_STROOPS="10000000000"  # 1000 XLM
DEADLINE_TIMESTAMP="<unix-timestamp-30-days-from-now>"
MIN_CONTRIBUTION_STROOPS="1000000"  # 0.1 XLM

# Campaign metadata
CAMPAIGN_TITLE="My Awesome Campaign"
CAMPAIGN_DESCRIPTION="Help fund this amazing project"

# Platform fee (optional)
PLATFORM_FEE_ADDRESS="<platform-address>"
PLATFORM_FEE_BPS="250"  # 2.5%

# Frontend configuration
NEXT_PUBLIC_CONTRACT_ID="<will-be-set-after-deployment>"
NEXT_PUBLIC_RPC_URL="https://soroban-mainnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon.stellar.org"
EOF

# Load environment
source .env.mainnet
```

## Step 2: Build and Optimize WASM

### 2.1 Build Release WASM

```bash
# Build optimized WASM binary
cargo build --release --target wasm32-unknown-unknown

# Verify build succeeded
ls -lh target/wasm32-unknown-unknown/release/fund_my_cause.wasm
```

### 2.2 Optimize WASM Size

```bash
# Install wasm-opt if not already installed
npm install -g wasm-opt

# Optimize WASM binary
wasm-opt -Oz -o target/wasm32-unknown-unknown/release/fund_my_cause_optimized.wasm \
  target/wasm32-unknown-unknown/release/fund_my_cause.wasm

# Compare sizes
ls -lh target/wasm32-unknown-unknown/release/fund_my_cause*.wasm
```

### 2.3 Verify WASM Hash

```bash
# Calculate WASM hash for verification
sha256sum target/wasm32-unknown-unknown/release/fund_my_cause_optimized.wasm

# Save this hash for verification on Stellar Expert
```

## Step 3: Deploy Contracts

### 3.1 Deploy Crowdfund Contract

```bash
# Deploy crowdfund contract
CROWDFUND_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/fund_my_cause_optimized.wasm \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL)

echo "Crowdfund Contract ID: $CROWDFUND_CONTRACT_ID"

# Save contract ID
echo "CROWDFUND_CONTRACT_ID=$CROWDFUND_CONTRACT_ID" >> .env.mainnet
```

### 3.2 Deploy Registry Contract

```bash
# Build registry contract
cd contracts/registry
cargo build --release --target wasm32-unknown-unknown
cd ../..

# Deploy registry contract
REGISTRY_CONTRACT_ID=$(stellar contract deploy \
  --wasm contracts/registry/target/wasm32-unknown-unknown/release/fund_my_cause_registry.wasm \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL)

echo "Registry Contract ID: $REGISTRY_CONTRACT_ID"

# Save contract ID
echo "REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID" >> .env.mainnet
```

## Step 4: Initialize Contracts

### 4.1 Initialize Crowdfund Contract

```bash
# Calculate deadline (30 days from now)
DEADLINE=$(date -d "+30 days" +%s)

# Build initialization transaction
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL \
  -- initialize \
  --creator $CREATOR_ADDRESS \
  --token $TOKEN_ADDRESS \
  --goal $GOAL_STROOPS \
  --deadline $DEADLINE \
  --min_contribution $MIN_CONTRIBUTION_STROOPS \
  --title "$CAMPAIGN_TITLE" \
  --description "$CAMPAIGN_DESCRIPTION" \
  --social_links null \
  --platform_config null \
  --accepted_tokens null
```

### 4.2 Register Campaign in Registry

```bash
# Register campaign in registry
stellar contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --source-account $DEPLOYER_PUBLIC_KEY \
  --network public \
  --rpc-url $RPC_URL \
  -- register \
  --campaign_id $CROWDFUND_CONTRACT_ID
```

### 4.3 Verify Initialization

```bash
# Check campaign info
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- get_campaign_info

# Check campaign stats
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- get_stats

# Check registry
stellar contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- campaign_count
```

## Step 5: Verify Contracts on Stellar Expert

### 5.1 Access Stellar Expert

1. Go to https://stellar.expert/explorer/public
2. Search for your contract ID in the search bar

### 5.2 Verify Contract Code

1. Click on the contract
2. Go to "Code" tab
3. Verify the WASM hash matches your build:
   ```bash
   sha256sum target/wasm32-unknown-unknown/release/fund_my_cause_optimized.wasm
   ```

### 5.3 Check Contract Events

1. Go to "Events" tab
2. Verify "campaign:initialized" event was published
3. Check event parameters match your configuration

### 5.4 Inspect Contract Storage

1. Go to "Storage" tab
2. Verify all storage keys are set correctly:
   - CREATOR
   - TOKEN
   - GOAL
   - DEADLINE
   - STATUS (should be "Active")
   - TITLE
   - DESC

## Step 6: Update Frontend Configuration

### 6.1 Create Production Environment File

```bash
# Create apps/interface/.env.production
cat > apps/interface/.env.production << 'EOF'
NEXT_PUBLIC_CONTRACT_ID="<CROWDFUND_CONTRACT_ID>"
NEXT_PUBLIC_REGISTRY_CONTRACT_ID="<REGISTRY_CONTRACT_ID>"
NEXT_PUBLIC_RPC_URL="https://soroban-mainnet.stellar.org"
NEXT_PUBLIC_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
NEXT_PUBLIC_HORIZON_URL="https://horizon.stellar.org"
NEXT_PUBLIC_NETWORK_NAME="mainnet"

# Optional: Pinata IPFS configuration
NEXT_PUBLIC_PINATA_API_KEY="<your-pinata-api-key>"
NEXT_PUBLIC_PINATA_SECRET_API_KEY="<your-pinata-secret>"
EOF
```

### 6.2 Build Frontend

```bash
cd apps/interface

# Install dependencies
npm install

# Build for production
npm run build

# Verify build succeeded
ls -la .next/
```

### 6.3 Deploy Frontend

Choose one of the following deployment options:

#### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Follow prompts to connect GitHub repository
```

#### Option B: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy to Netlify
netlify deploy --prod --dir=.next
```

#### Option C: Self-Hosted

```bash
# Build Docker image
docker build -t fund-my-cause:latest .

# Push to registry
docker push <your-registry>/fund-my-cause:latest

# Deploy to your infrastructure
# (e.g., AWS ECS, Kubernetes, etc.)
```

## Step 7: Post-Deployment Verification

### 7.1 Test Contribution Flow

1. Open frontend in browser
2. Connect wallet with Freighter
3. Verify network is set to mainnet
4. Make a small test contribution (0.1 XLM)
5. Verify transaction appears on Stellar Expert
6. Check campaign stats updated

### 7.2 Verify Contract Events

```bash
# Check recent events
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- get_stats

# Should show:
# - total_raised: 1000000 (0.1 XLM from test)
# - contributor_count: 1
# - progress_bps: calculated percentage
```

### 7.3 Monitor Contract Health

```bash
# Set up monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== Campaign Stats ==="
  stellar contract invoke \
    --id $CROWDFUND_CONTRACT_ID \
    --network public \
    --rpc-url $RPC_URL \
    -- get_stats
  
  echo "=== Contract Status ==="
  stellar contract invoke \
    --id $CROWDFUND_CONTRACT_ID \
    --network public \
    --rpc-url $RPC_URL \
    -- status
  
  sleep 300  # Check every 5 minutes
done
EOF

chmod +x monitor.sh
./monitor.sh
```

## Post-Deployment Checklist

- [ ] Crowdfund contract deployed and verified on Stellar Expert
- [ ] Registry contract deployed and verified on Stellar Expert
- [ ] Campaign initialized with correct parameters
- [ ] Campaign registered in registry
- [ ] WASM hash verified on Stellar Expert
- [ ] Frontend environment variables updated
- [ ] Frontend built and deployed
- [ ] Test contribution successful
- [ ] Contract events published correctly
- [ ] Monitoring script running
- [ ] Backup of contract IDs and deployment info
- [ ] Documentation updated with contract IDs
- [ ] Team notified of deployment
- [ ] Social media announcement prepared
- [ ] Support channels ready for user questions

## Rollback Procedures

### If Deployment Fails

1. **Contract Deployment Failed**
   - Check error message from Stellar CLI
   - Verify WASM binary is valid
   - Ensure deployer account has sufficient XLM
   - Retry deployment

2. **Initialization Failed**
   - Verify all parameters are correct
   - Check creator address is valid
   - Ensure token address is correct
   - Verify deadline is in future

3. **Frontend Deployment Failed**
   - Check build logs for errors
   - Verify environment variables are set
   - Ensure contract IDs are correct
   - Retry deployment

### If Issues Found Post-Deployment

1. **Critical Bug in Contract**
   - Deploy new contract version
   - Update frontend to use new contract ID
   - Notify users of migration
   - Provide refund mechanism if needed

2. **Frontend Issues**
   - Rollback to previous version
   - Fix issues in development
   - Redeploy updated version

3. **Configuration Issues**
   - Update environment variables
   - Redeploy frontend
   - No contract changes needed

## Monitoring and Maintenance

### Daily Checks

```bash
# Check contract is responsive
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- version

# Check recent contributions
stellar contract invoke \
  --id $CROWDFUND_CONTRACT_ID \
  --network public \
  --rpc-url $RPC_URL \
  -- get_stats
```

### Weekly Checks

1. Review contract events on Stellar Expert
2. Check frontend error logs
3. Verify all transactions are processing
4. Monitor gas costs and adjust if needed

### Monthly Checks

1. Review campaign performance metrics
2. Check for any security issues
3. Update documentation if needed
4. Plan for future enhancements

## Troubleshooting

### Common Issues

#### "Insufficient balance for transaction"
- Ensure deployer account has at least 10 XLM
- Check account balance: `stellar account info <KEY> --network public`
- Fund account with more XLM

#### "Contract not found"
- Verify contract ID is correct
- Check contract was deployed to correct network
- Verify RPC URL is correct

#### "Invalid parameter"
- Check all parameters are correct type
- Verify deadline is in future
- Ensure goal is > 0

#### "Transaction timeout"
- Increase timeout value
- Check RPC endpoint is responsive
- Retry transaction

#### "WASM validation failed"
- Rebuild WASM binary
- Verify Rust version is compatible
- Check for compilation errors

### Getting Help

1. Check Stellar documentation: https://developers.stellar.org
2. Review Soroban docs: https://soroban.stellar.org
3. Check GitHub issues: https://github.com/stellar/rs-soroban-sdk
4. Ask in Stellar Discord: https://discord.gg/stellar

## Security Considerations

### Before Deployment

1. **Code Audit**
   - Have contract code reviewed by security expert
   - Run automated security scanners
   - Test all edge cases

2. **Key Management**
   - Use hardware wallet for deployer key
   - Never commit secret keys to repository
   - Use environment variables for sensitive data

3. **Testing**
   - Test on testnet first
   - Verify all functions work correctly
   - Test with multiple users
   - Test edge cases and error conditions

### After Deployment

1. **Monitor Activity**
   - Watch for unusual transaction patterns
   - Monitor gas costs
   - Check for failed transactions

2. **Incident Response**
   - Have rollback plan ready
   - Document all incidents
   - Communicate with users if needed

3. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Plan for future upgrades

## Performance Optimization

### Gas Cost Reduction

1. **Batch Operations**
   - Combine multiple operations when possible
   - Reduce number of storage accesses

2. **Storage Optimization**
   - Use efficient data structures
   - Minimize storage writes
   - Use persistent storage for large data

3. **Contract Optimization**
   - Profile contract execution
   - Optimize hot paths
   - Remove unnecessary operations

### Scalability

1. **Pagination**
   - Use pagination for large lists
   - Limit results per query
   - Cache results on frontend

2. **Caching**
   - Cache campaign stats on frontend
   - Reduce RPC calls
   - Update cache on events

3. **Load Balancing**
   - Use multiple RPC endpoints
   - Distribute requests
   - Monitor endpoint health

## Future Enhancements

1. **Multi-Contract Deployment**
   - Deploy multiple campaign contracts
   - Use factory pattern for campaign creation

2. **Governance**
   - Add DAO governance
   - Community voting on parameters
   - Decentralized fee management

3. **Advanced Features**
   - Milestone-based funding
   - Secondary market for campaign tokens
   - Insurance and escrow services

## References

- [Stellar Documentation](https://developers.stellar.org)
- [Soroban Documentation](https://soroban.stellar.org)
- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- [Stellar Expert](https://stellar.expert)
- [Freighter Wallet](https://www.freighter.app)
