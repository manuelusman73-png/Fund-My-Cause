# Contributing to Fund-My-Cause

Thank you for your interest in contributing to Fund-My-Cause! We welcome contributions from the community.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How to Report Bugs

Found a bug? Please open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Include:

- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Your environment (OS, browser, Node.js version, etc.)
- Screenshots or error logs if applicable

## How to Propose Features

Have an idea? Open an issue using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Include:

- Problem statement: what problem does this solve?
- Proposed solution: how should it work?
- Alternative approaches you've considered
- Any additional context

## Branch Naming Convention

Use the following format for branch names:

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `chore/<description>` — maintenance, dependencies, tooling
- `docs/<description>` — documentation updates
- `refactor/<description>` — code refactoring without behavior changes

Example: `feat/campaign-metadata-update`, `fix/freighter-connection-timeout`

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation
- `style` — formatting, missing semicolons, etc.
- `refactor` — code refactoring
- `perf` — performance improvements
- `test` — adding or updating tests
- `chore` — build, dependencies, tooling

**Example:**
```
feat(contracts): add campaign metadata update function

Allow creators to update campaign title and description
while the campaign is active.

Closes #42
```

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Branch is based on latest `main`
- [ ] Commit messages follow Conventional Commits format
- [ ] Code follows project style (Rust: `cargo fmt`, TypeScript: `prettier`)
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated (README, code comments, etc.)
- [ ] No console errors or warnings
- [ ] Snapshots updated if UI changed (`npm run test -- -u`)

## Running the Full Test Suite Locally

### Contracts (Rust)

```bash
# Build WASM
cargo build --release --target wasm32-unknown-unknown

# Run all tests
cargo test --workspace

# Run tests with output
cargo test --workspace -- --nocapture

# Run specific test
cargo test --package crowdfund test_contribute -- --nocapture
```

### Frontend (TypeScript)

```bash
cd apps/interface

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Updating Snapshots

If you intentionally change a component's UI or contract behavior, update snapshots:

```bash
cd apps/interface

# Update Jest snapshots
npm test -- -u

# Or with Vitest
vitest -u
```

Commit updated snapshot files alongside your component changes so reviewers can see the visual diff.

## Development Setup

### Quick Start

1. Clone the repo:
   ```bash
   git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
   cd Fund-My-Cause
   ```

2. Install dependencies:
   ```bash
   npm install
   cd apps/interface && npm install
   ```

3. Build contracts:
   ```bash
   cargo build --release --target wasm32-unknown-unknown
   ```

4. Run tests:
   ```bash
   cargo test --workspace
   cd apps/interface && npm test
   ```

### Local Development

**Frontend:**
```bash
cd apps/interface
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

**Contracts:**
```bash
cargo build --release --target wasm32-unknown-unknown
cargo test --workspace -- --nocapture
```

## Project Structure

```
Fund-My-Cause/
├── apps/interface/          # Next.js frontend
├── contracts/
│   ├── crowdfund/          # Main crowdfunding contract
│   └── registry/           # Campaign registry contract
├── scripts/                # Deployment and utility scripts
├── e2e/                    # End-to-end tests
└── .github/                # GitHub workflows and templates
```

## Questions?

- Check existing [issues](https://github.com/Fund-My-Cause/Fund-My-Cause/issues)
- Review [README.md](./README.md) for setup and architecture
- Open a [discussion](https://github.com/Fund-My-Cause/Fund-My-Cause/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
