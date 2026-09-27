# Contributing to VoteChain

Thank you for contributing! VoteChain is an open-source governance protocol built on Stellar Soroban.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Issue Triage Process](#issue-triage-process)
- [Branch Protection Rules](#branch-protection-rules)
- [Branching Strategy](#branching-strategy)
- [Commit Messages](#commit-messages)
- [Development Workflow](#development-workflow)
- [Architecture Decision Records](#architecture-decision-records)
- [Pull Request Process](#pull-request-process)
- [Code Review Expectations](#code-review-expectations)
- [Reporting Bugs](#reporting-bugs)
- [License](#license)

---

## Getting Started

**Prerequisites:** Rust stable toolchain, `wasm32-unknown-unknown` target, and (optionally) Docker.

```bash
git clone https://github.com/veracindarella/votechain-contracts.git
cd votechain-contracts
rustup target add wasm32-unknown-unknown
make test
```

For a fully reproducible environment without a local Rust installation, use Docker:

```bash
docker compose run --rm dev make test
```

---

## Issue Triage Process

To maintain clarity and prioritise work effectively, all new issues follow a standardised triage workflow.

### Who triages?

- **Maintainers** perform initial triage.
- Triage should happen at least **weekly**.
- New issues are triaged **within 3 days** of creation.

### How to triage an issue

1. **Review the issue** for completeness:
   - Bug reports should include steps to reproduce and expected vs. actual behaviour.
   - Feature requests should clearly state the motivation and acceptance criteria.
   - If incomplete, request additional information using the relevant template.

2. **Apply labels** using this taxonomy:

   | Label | When to use |
   | ----- | ----------- |
   | `bug` | Unintended behaviour |
   | `enhancement` | New feature or capability improvement |
   | `documentation` | Docs, guides, or examples |
   | `good first issue` | Simple, well-scoped task suitable for newcomers |
   | `help wanted` | Needs community contribution; maintainers may not prioritise |
   | `security` | Security-related issues (use private disclosure for vulnerabilities) |
   | `question` | Request for information or clarification |
   | `blocked` | Waiting on external dependency or decision |
   | `critical` | Severely impacts functionality or security |
   | `high` | Important; should be scheduled soon |
   | `medium` | Standard priority |
   | `low` | Nice to have; backlog |

3. **Assign a priority label** (`critical`, `high`, `medium`, or `low`) based on impact and urgency.

4. **Assign an owner** if you have capacity, or leave unassigned and add `help wanted`.

### Response SLA expectations

Response times and resolution targets by priority:

| Priority | Response SLA | Resolution Target |
| -------- | ------------ | ----------------- |
| 🔴 Critical | 24 hours | 1 week |
| 🟠 High | 72 hours | 2 weeks |
| 🟡 Medium | 1 week | 1 month |
| 🟢 Low | Best effort | Backlog |

**Definition:**

- **Response SLA:** Time for maintainer to acknowledge the issue, ask clarifying questions, or begin work.
- **Resolution target:** Estimated time to merge a PR or close the issue.

### Stale issues

- Issues with no activity for **60 days** are marked with the `stale` label and a comment explaining the inactivity.
- If no response within **30 days** of the stale warning, the issue is closed automatically.
- Reopening is always possible if the original concern is still valid.

---

The `main` branch is protected. These rules are enforced via GitHub branch protection settings and cannot be bypassed by any contributor, including maintainers.

### Enforced rules

| Rule | Setting |
| ---- | ------- |
| Require CI to pass before merge | ✅ Enabled — all status checks must be green |
| Require pull request before merging | ✅ Enabled — direct pushes to `main` are blocked |
| Required approving reviews | **1** — at least one maintainer approval is required |
| Dismiss stale reviews on new push | ✅ Enabled — approval is invalidated when new commits are pushed |
| Force pushes | ❌ Disabled — history rewriting on `main` is not allowed |
| Branch deletions | ❌ Disabled — `main` cannot be deleted |

### Required status checks

The following CI jobs must pass before a PR can be merged:

- `test` — full test suite (`make test`)
- `fmt-check` — formatting check (`make fmt-check`)
- `lint` — Clippy warnings-as-errors (`make lint`)
- `audit` — dependency vulnerability scan (`cargo audit`)

### Configuring branch protection (maintainers only)

To apply or update these rules on GitHub:

1. Go to **Settings → Branches** in the repository.
2. Under **Branch protection rules**, click **Add rule** (or edit the existing `main` rule).
3. Set **Branch name pattern** to `main`.
4. Enable the following options:
   - ✅ **Require a pull request before merging**
     - Set **Required approvals** to `1`
     - ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - ✅ **Require status checks to pass before merging**
     - ✅ **Require branches to be up to date before merging**
     - Add the status checks: `test`, `fmt-check`, `lint`, `audit`
   - ✅ **Do not allow bypassing the above settings**
   - ❌ Leave **Allow force pushes** unchecked
   - ❌ Leave **Allow deletions** unchecked
5. Click **Save changes**.

> **Note:** These settings apply to all contributors including administrators. If you need to make an emergency hotfix directly to `main`, temporarily disable the rule, apply the fix, then re-enable it and document the exception in the PR or commit message.

---

## Branching Strategy

All work happens in short-lived topic branches that target `main`.

| Prefix | Purpose | Example |
| ------ | ------- | ------- |
| `feature/` | New functionality | `feature/delegation-support` |
| `fix/` | Bug fixes | `fix/double-vote-edge-case` |
| `docs/` | Documentation only | `docs/update-lifecycle-diagram` |
| `test/` | New or improved tests | `test/quorum-boundary-cases` |
| `chore/` | Maintenance, tooling, CI | `chore/bump-soroban-sdk` |
| `security/` | Security fixes | `security/reinit-guard` |
| `refactor/` | Code restructuring without behaviour change | `refactor/storage-helpers` |

**Rules:**

- Branch from the latest `main`.
- Keep branches focused — one logical change per branch.
- Delete the branch after it is merged.
- Do not commit directly to `main`; all changes must go through a pull request.

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<optional scope>): <short summary in lower case>

<optional body — explain the why, not the what>
```

**Types:**

| Type | When to use |
| ---- | ----------- |
| `feat` | New feature or contract function |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore` | Build scripts, CI, dependencies, tooling |
| `security` | Security-related fixes or hardening |
| `perf` | Performance improvement |

**Examples:**

```text
feat: add delegation support to governance contract

fix(cast_vote): prevent double-vote across proposal lifecycle

test: add quorum boundary edge cases to prop_tests

chore: upgrade soroban-sdk to 22.1.0

docs(lifecycle): clarify abstain vote quorum behaviour
```

**Rules:**

- Summary line ≤ 72 characters, lower case, no trailing period.
- Use the imperative mood: "add", "fix", "remove" — not "added" or "fixes".
- Reference the relevant issue in the body when applicable: `Closes #52`.

---

## Development Workflow

### Running tests

```bash
# Run the full test suite (unit + property-based)
make test

# Run tests for a single crate
cargo test -p votechain-governance
cargo test -p votechain-token

# Run a specific test by name
cargo test test_cast_vote_and_finalise_passed

# Show println!/dbg! output from passing tests
cargo test -- --nocapture
```

### Formatting and linting

```bash
# Auto-format all source files (run before every commit)
make fmt

# Check formatting without modifying files (same check CI runs)
make fmt-check

# Run Clippy and fail on any warning (same check CI runs)
make lint
```

### Building WASM contracts

```bash
# Compile both contracts to optimised WASM
make build

# Alternatively, use the Stellar CLI directly
stellar contract build
```

Built WASM files are written to `target/wasm32-unknown-unknown/release/`.

### Contract standards

Every contribution to the contract crates must follow these invariants or the CI will fail:

- `#![no_std]` — all contract crates are `no_std`.
- No floating-point arithmetic — all vote weights and balances use `i128`.
- Every state-changing function must emit the corresponding on-chain event.
- Every new public function requires at least one test in `test.rs`.
- `cargo fmt --check` and `cargo clippy -- -D warnings` must pass cleanly.
- `cargo audit` must report zero advisories.

---

## Architecture Decision Records

An Architecture Decision Record (ADR) captures a significant choice made during development — the context, what was decided, and the trade-offs accepted. ADRs live in [`docs/adr/`](docs/adr/).

### When an ADR is required

Write an ADR whenever a change involves **significant trade-offs** that future contributors should understand. Use this rule of thumb:

> If a reviewer might ask "why did you do it this way?" and the answer is longer than a commit message, write an ADR.

Concrete triggers:
- Choosing between two or more viable technical approaches
- Changing a core data structure, storage tier, or contract interface
- Introducing a new external dependency or protocol
- Deprecating or replacing an existing architectural pattern
- Any security-sensitive design choice

You do **not** need an ADR for: bug fixes, test additions, documentation updates, tooling bumps, or refactors that preserve observable behavior.

### ADR template

Copy [`docs/adr/TEMPLATE.md`](docs/adr/TEMPLATE.md) and name your file `ADR-NNN-short-title.md`, where `NNN` is the next sequential number. Fill in all sections and set the status to `Proposed`.

### Review process

1. Open a PR with the new ADR file and a summary of the decision in the PR description.
2. Link the ADR from [`docs/adr/README.md`](docs/adr/README.md).
3. Discussion happens in the PR. Once consensus is reached, update the status to `Accepted` before merging.
4. If a later decision supersedes this ADR, mark the old one `Superseded by ADR-NNN` rather than deleting it.

### Examples

Two good ADRs to read for reference:

- **Simple decision — [ADR-001: Use Stellar Soroban as the smart contract platform](docs/adr/ADR-001-stellar-soroban-platform.md):** A concise record selecting the contract platform with clear reasoning and consequences. Good template for single-choice decisions.
- **Complex decision — [ADR-006: Instance vs persistent storage tier assignment](docs/adr/ADR-006-instance-vs-persistent-storage.md):** Documents a nuanced trade-off with performance, cost, and correctness implications. Good template for decisions with multiple interacting factors.

### CI warning for large contract changes

A CI check warns when a PR adds a new function larger than 50 lines to `contracts/governance/src/lib.rs` without including a new ADR file. This is a **warning, not a failure** — it is a prompt to consider whether the change warrants documentation, not a hard block. If the change genuinely does not need an ADR, note that in the PR description.

---

## Pull Request Process

1. **Open a draft PR early** if you want feedback on the approach before the implementation is complete.
2. **Fill in the PR template** — describe the change, link the issue, and check every box in the checklist.
3. **Keep PRs small and focused.** A PR that fixes one thing is easier to review and faster to merge than one that fixes five.
4. **Resolve all CI failures before requesting review.** Do not ask reviewers to look at a red build.
5. **Respond to review comments** within a reasonable time. If a thread is resolved by a code change, mark it resolved.
6. Squash or clean up noisy "fixup" commits before the final merge.

### PR checklist

- [ ] `make fmt` run locally
- [ ] `make test` passes
- [ ] `make lint` passes
- [ ] Events emitted for every state-changing operation
- [ ] New public functions have tests
- [ ] `README.md` updated if observable behaviour changed
- [ ] `CHANGELOG.md` `[Unreleased]` section updated for user-visible changes

---

## Code Review Expectations

**For authors:**

- A PR description should make it easy for reviewers to understand *why* the change is needed, not just *what* changed.
- Annotate non-obvious design choices with inline comments or PR comments so reviewers don't have to reverse-engineer your reasoning.
- Be receptive to feedback — a requested change is a conversation, not a rejection.

**For reviewers:**

- Every PR targeting `main` requires at least **one approving review** from a maintainer before merge.
- Check that:
  - The logic is correct and the new/changed code is tested.
  - All state-changing functions emit the appropriate event.
  - No `f32`/`f64` arithmetic is introduced.
  - The `no_std` constraint is preserved.
  - Error variants are descriptive and match the existing `ContractError` style.
  - The PR checklist has been completed.
- Distinguish between blocking concerns (must fix) and suggestions (nice to have) when leaving comments.
- Approve once all blocking concerns are addressed; do not block a merge on optional style preferences.

---

## Reporting Bugs

**Security vulnerabilities** — do **not** open a public issue. Follow the responsible disclosure process in [SECURITY.md](SECURITY.md).

**Regular bugs** — open a GitHub Issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

- A short, clear title describing the unexpected behaviour.
- The function or contract that exhibits the bug.
- Steps to reproduce (minimal Rust test case preferred).
- Expected behaviour vs. actual behaviour.
- Soroban SDK version and Rust toolchain version (`rustc --version`).

Pull requests that fix bugs are welcome alongside or instead of an issue.

---

## License

By contributing you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).

### License headers

Every source file (`.rs`, `.ts`, `.tsx`, `.sh`, `.sql`) must start with the Apache 2.0 header
(after the shebang line for shell scripts). CI fails if it is missing. Use the comment
syntax of the language (`//` for Rust/TypeScript, `#` for shell, `--` for SQL):

```
// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
```
