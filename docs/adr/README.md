# Architecture Decision Records

This directory contains ADRs for VoteChain — records of significant architectural choices made during development.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](ADR-001-stellar-soroban-platform.md) | Use Stellar Soroban as the smart contract platform | Accepted |
| [ADR-002](ADR-002-token-weighted-voting.md) | Token-weighted voting model | Accepted |
| [ADR-003](ADR-003-live-balance-over-snapshot.md) | Use live token balance instead of vote snapshots | Accepted |
| [ADR-004](ADR-004-three-way-vote.md) | Three-way vote: Yes / No / Abstain | Accepted |
| [ADR-005](ADR-005-on-chain-events.md) | Emit on-chain events for all state transitions | Accepted |
| [ADR-006](ADR-006-instance-vs-persistent-storage.md) | Instance vs persistent storage tier assignment | Accepted |
| [ADR-010](ADR-010-frontend-framework-vite-react.md) | Frontend framework: Vite + React + TypeScript | Accepted |
| [ADR-011](ADR-011-no-state-management-library.md) | No dedicated state management library (Context API) | Accepted |
| [ADR-012](ADR-012-freighter-sole-wallet.md) | Freighter as the sole wallet integration target | Accepted |

To create a new ADR, copy [TEMPLATE.md](TEMPLATE.md), number it sequentially, and open a PR.
