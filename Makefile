.PHONY: help build-contract test-contract deploy-testnet dev-frontend test-frontend lint install-deps clean format

# Default target - show help
help:
	@echo "Fund-My-Cause - Common Developer Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  make build-contract     Build Rust contracts to WebAssembly"
	@echo "  make test-contract      Run all Rust contract tests"
	@echo "  make deploy-testnet     Deploy contract to Stellar testnet"
	@echo "  make dev-frontend       Start frontend development server"
	@echo "  make test-frontend      Run frontend tests"
	@echo "  make lint               Run linters (Rust clippy + ESLint)"
	@echo "  make install-deps       Install all dependencies"
	@echo "  make clean              Clean build artifacts"
	@echo "  make format             Format code (Rust + JavaScript)"
	@echo ""
	@echo "Example workflow:"
	@echo "  make install-deps       # One-time setup"
	@echo "  make build-contract"
	@echo "  make test-contract"
	@echo "  make lint"
	@echo "  make dev-frontend"

# Build Rust contracts to WebAssembly
build-contract:
	@echo "Building Rust contracts..."
	cargo build --release --target wasm32-unknown-unknown

# Run all Rust contract tests
test-contract:
	@echo "Testing Rust contracts..."
	cargo test --workspace

# Deploy contract to Stellar testnet
# Usage: make deploy-testnet CREATOR=<account> TOKEN=<token_id> GOAL=<amount> DEADLINE=<unix_timestamp>
deploy-testnet:
	@if [ -z "$(CREATOR)" ] || [ -z "$(TOKEN)" ] || [ -z "$(GOAL)" ] || [ -z "$(DEADLINE)" ]; then \
		echo "Error: Required parameters missing"; \
		echo "Usage: make deploy-testnet CREATOR=<account> TOKEN=<token_id> GOAL=<amount> DEADLINE=<unix_timestamp>"; \
		echo ""; \
		echo "Optional parameters:"; \
		echo "  MIN_CONTRIBUTION=<amount>   (default: 1)"; \
		echo "  TITLE=<string>              (default: 'Default Title')"; \
		echo "  DESCRIPTION=<string>        (default: 'Default Description')"; \
		echo "  SOCIAL_LINKS=<json>         (default: null)"; \
		echo "  REGISTRY_ID=<contract_id>   (deploys new registry if not provided)"; \
		exit 1; \
	fi
	@./scripts/deploy.sh \
		"$(CREATOR)" \
		"$(TOKEN)" \
		"$(GOAL)" \
		"$(DEADLINE)" \
		"$(MIN_CONTRIBUTION)" \
		"$(TITLE)" \
		"$(DESCRIPTION)" \
		"$(SOCIAL_LINKS)" \
		"$(REGISTRY_ID)"

# Start frontend development server
dev-frontend:
	@echo "Starting frontend development server..."
	cd apps/interface && npm run dev

# Run frontend tests
test-frontend:
	@echo "Running frontend tests..."
	cd apps/interface && npm test

# Run linters (Rust clippy + ESLint)
lint:
	@echo "Running Rust clippy..."
	cargo clippy --workspace --all-targets
	@echo "Running ESLint on frontend..."
	cd apps/interface && npm run lint

# Install all dependencies
install-deps:
	@echo "Installing Rust dependencies..."
	cargo fetch
	@echo "Installing frontend dependencies..."
	cd apps/interface && npm install

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	cd apps/interface && rm -rf .next out

# Format code (Rust + JavaScript)
format:
	@echo "Formatting Rust code..."
	cargo fmt --all
	@echo "Formatting JavaScript/TypeScript code..."
	cd apps/interface && npm run format 2>/dev/null || npx prettier --write "src/**/*.{ts,tsx,js,jsx}" || true
