# Contract Error Reference

All `ContractError` codes returned by VoteChain smart contracts as `u32` values.

---

## Governance Contract

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| 1 | `AdminNotSet` | Contract has not been initialized — no admin address is stored. | Call `initialize(admin, voting_token)` before invoking any other function. |
| 2 | `NotAdmin` | Caller is not the configured admin address. | Sign the transaction with the admin keypair set during `initialize`. |
| 3 | `VotingTokenNotSet` | The governance token address was not set during initialization. | Re-initialize the contract with a valid `voting_token` address. |
| 4 | `InvalidQuorum` | `quorum` passed to `create_proposal` is zero or negative. | Provide a quorum value greater than zero (denominated in token units). |
| 5 | `InvalidDuration` | `duration` passed to `create_proposal` is zero. | Provide a duration of at least 1 ledger. |
| 6 | `ProposalNotFound` | No proposal exists for the given `proposal_id`. | Verify the ID with `proposal_count()` — valid IDs are in the range `[1, proposal_count]`. |
| 7 | `ProposalNotActive` | The proposal is not in `Active` status (e.g. already Passed, Rejected, Executed, or Cancelled). | Check the proposal status with `get_proposal(proposal_id)` before calling the function. |
| 8 | `VotingPeriodEnded` | The current ledger timestamp is past the proposal's `end_time`. | The voting window has closed; call `finalise(proposal_id)` to settle the result. |
| 9 | `VotingStillOpen` | `finalise` was called before the voting period has ended. | Wait until the ledger timestamp exceeds the proposal's `end_time`, then retry. |
| 10 | `AlreadyVoted` | The voter address has already cast a vote on this proposal. | Each address may vote exactly once. Use `has_voted(proposal_id, voter)` to check before calling `cast_vote`. |
| 11 | `NoVotingPower` | The voter holds zero governance tokens at the time of voting. | Acquire a non-zero balance of the governance token before casting a vote. |
| 12 | `ProposalNotPassed` | `execute` was called on a proposal that did not reach `Passed` status. | Confirm the proposal status is `Passed` with `get_proposal(proposal_id)` before calling `execute`. |
| 21 | `InvalidDurationRange` | A duration parameter is outside the allowed range. | For `create_proposal`, the `duration` must be within `[min_duration, max_duration]` as configured at init. For `update_timelock`, `new_duration` must not exceed 2,592,000 seconds (30 days). |
| 30 | `TimelockNotExpired` | `execute` was called before the proposal's `execute_after` timestamp has been reached. | Wait until `env.ledger().timestamp() >= proposal.execute_after`, then retry. Use `get_proposal(proposal_id).execute_after` to check the earliest eligible execution time. |

---

## Token Contract

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| 1 | `AdminNotSet` | Token contract has not been initialized — no admin address is stored. | Initialize the token contract with an admin address before minting or configuring it. |
| 2 | `NotAdmin` | Caller is not the token contract admin. | Sign the transaction with the admin keypair used during token initialization. |
| 3 | `InvalidAmount` | The amount provided to `transfer`, `mint`, or `burn` is zero or negative. | Provide a positive integer amount. |
| 4 | `InsufficientBalance` | The sender's token balance is less than the requested transfer or burn amount. | Check the sender's balance before initiating the operation and ensure sufficient funds. |
| 5 | `AllowanceExceeded` | The spender's approved allowance is less than the requested `transfer_from` amount. | Call `approve` to increase the allowance before calling `transfer_from`. |

---

## Notes

- Error codes are scoped per contract — code `1` in the governance contract and code `1` in the token contract are independent.
- Errors are returned as `Result::Err(ContractError)` and surface as a `u32` in Soroban host diagnostics.
- Use `get_proposal(proposal_id)` and `has_voted(proposal_id, voter)` as pre-flight checks to avoid the most common errors.

---

## API Error Codes

All HTTP API responses from the VoteChain REST indexer use a consistent JSON error envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Proposal 42 not found",
    "details": []
  }
}
```

The `code` field is a machine-readable string constant. The `message` field provides a human-readable description. The `details` array is reserved for future use (e.g. field-level validation errors).

### HTTP Status Codes and Error Code Mapping

| HTTP Status | Error Code | Description | Example Trigger |
|-------------|------------|-------------|-----------------|
| 400 | `BAD_REQUEST` | The request body or query parameters are malformed or fail validation. | Invalid JSON body; `quorum` is zero; `duration` outside allowed range. |
| 401 | `UNAUTHORIZED` | The request lacks valid authentication credentials. | Missing or expired bearer token. |
| 403 | `FORBIDDEN` | The caller is authenticated but does not have permission for this action. | Non-admin address calling an admin-only endpoint. |
| 404 | `NOT_FOUND` | The requested resource does not exist. | Unknown proposal ID; unmatched route path. |
| 429 | `RATE_LIMITED` | The caller has exceeded the allowed request rate. | Proposer within cooldown period; too many requests per minute. |
| 500 | `INTERNAL_ERROR` | An unexpected server-side error occurred. | Unhandled exception; storage layer failure. |

### Contract Error to HTTP Status Mapping

When the indexer or API layer surfaces a smart contract error, the following mapping applies:

| Contract Error | HTTP Status | API Error Code |
|----------------|-------------|----------------|
| `ProposalNotFound` | 404 | `NOT_FOUND` |
| `NotFound` | 404 | `NOT_FOUND` |
| `InvalidQuorum` | 400 | `BAD_REQUEST` |
| `InvalidDuration` / `InvalidDurationRange` | 400 | `BAD_REQUEST` |
| `InvalidTitle` | 400 | `BAD_REQUEST` |
| `InvalidDescription` | 400 | `BAD_REQUEST` |
| `InvalidAmount` | 400 | `BAD_REQUEST` |
| `NotAdmin` | 403 | `FORBIDDEN` |
| `AdminVoteRestricted` | 403 | `FORBIDDEN` |
| `ProposalCooldown` | 429 | `RATE_LIMITED` |
| All other errors | 500 | `INTERNAL_ERROR` |

### Notes

- `500 INTERNAL_ERROR` responses never include stack traces or internal implementation details. Check server logs for diagnostics.
- The `details` array in the envelope is currently always empty. It will be used in a future version to carry per-field validation errors (e.g. `[{ "field": "quorum", "issue": "must be > 0" }]`).
- Route-not-found errors (`404 NOT_FOUND`) include the HTTP method and path in the message, e.g. `Route GET /api/unknown not found`.
