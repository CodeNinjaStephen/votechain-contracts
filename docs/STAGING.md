# Staging environment

This repository includes a dedicated `staging` environment for integration testing before mainnet. (#67)

- Config: [config/staging.toml](config/staging.toml#L1)
- Deploy script: `scripts/deploy_staging.sh` — wrapper that calls `scripts/deploy.sh` with `NETWORK=staging`, then
  writes the resulting contract IDs into both `.env.staging` and `config/staging.toml`.
- Smoke test script: `scripts/smoke_test_staging.sh` — exercises the full proposal lifecycle
  (initialise → create proposal → cast vote → finalise) against the freshly deployed contracts,
  using a fresh keypair funded from the Stellar testnet friendbot.
- CI workflow: [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml) —
  runs the deploy script and the smoke test automatically on every merge to `develop`.

Usage:

1. Edit `config/staging.toml` and set `rpc_url` and `network_passphrase` for your staging Soroban network.
2. Run the deploy script:

```bash
chmod +x ./scripts/deploy_staging.sh
./scripts/deploy_staging.sh
```

The deploy script writes contract IDs to `.env.staging` and mirrors them into `config/staging.toml`.

3. Run the smoke test against the deployment:

```bash
chmod +x ./scripts/smoke_test_staging.sh
./scripts/smoke_test_staging.sh
```

The current staging deploy status is shown by the badge at the top of the
[README](../README.md).

## Known gaps

- The smoke test's `initialize` calls assume the staging contracts are being
  initialised for the first time on this deployment. Re-running the workflow
  against contract IDs that are already initialised will fail on the
  `initialize` step with `AlreadyInitialized` — redeploy fresh contract
  instances (which `deploy_staging.sh` does on every run) before re-running.
- The smoke test has not been exercised against a live testnet in this
  change; the contract function names and argument shapes were taken
  directly from `contracts/governance/src/lib.rs` and `contracts/token/src/lib.rs`,
  but CLI argument encoding for the `Vote` enum in particular is worth a
  manual dry run before relying on it as a release gate.
