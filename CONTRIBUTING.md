# Contributing to Fund-My-Cause

Thank you for your interest in contributing!

## Getting Started

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes following the patterns in the codebase.
3. Commit using conventional commits: `git commit -m "feat: add X"`
4. Open a pull request against `main`.

## Running Tests

```bash
cd apps/interface
npm test
```

## Updating UI Snapshots

If you intentionally change a component's UI, update the snapshots by running:

```bash
npm run test -- -u
```

or

```bash
vitest -u
```

Commit the updated snapshot files alongside your component changes so reviewers can see the visual diff.
