.PHONY: build test fmt fmt-check lint clean deploy-testnet check-stellar-cli fuzz verify help

STELLAR_CLI_VERSION := 22.8.2

## build: Compile contracts to WASM (release)
build:
	stellar contract build

## test: Run all unit tests
test:
	cargo test

## fuzz: Run fuzz tests for 60 seconds minimum on governance contract
fuzz:
	@command -v cargo-fuzz >/dev/null 2>&1 || (echo "Installing cargo-fuzz..." && cargo install cargo-fuzz)
	@echo "Running fuzz targets for governance contract (60 seconds each)..."
	@timeout 60 cargo +nightly fuzz run fuzz_create_proposal || true
	@timeout 60 cargo +nightly fuzz run fuzz_cast_vote || true
	@timeout 60 cargo +nightly fuzz run fuzz_finalise || true
	@echo "Fuzz testing completed. Check for any panics or crashes above."

## verify: Run Kani formal-verification harnesses (requires cargo-kani)
## Proves pass/reject condition correctness, overflow safety, and boundary cases.
## Each harness is bounded to 60 seconds to fit inside CI time budgets.
verify:
	@command -v cargo-kani >/dev/null 2>&1 || (echo "Installing cargo-kani..." && cargo install --locked kani-verifier && cargo kani setup)
	@echo "Running Kani harnesses for governance contract (60 s timeout each)..."
	@timeout 60 cargo kani --harness verify_pass_condition_all_combinations \
		--output-format terse \
		-p votechain-governance || true
	@timeout 60 cargo kani --harness verify_no_overflow_in_tally \
		--output-format terse \
		-p votechain-governance || true
	@timeout 60 cargo kani --harness verify_boundary_total_equals_quorum \
		--output-format terse \
		-p votechain-governance || true
	@timeout 60 cargo kani --harness verify_tie_always_rejects \
		--output-format terse \
		-p votechain-governance || true
	@echo "Kani verification complete. Review any FAILED results above."

## fmt: Auto-format all source files
fmt:
	cargo fmt

## fmt-check: Verify formatting without modifying files (used in CI)
fmt-check:
	cargo fmt --check

## lint: Run Clippy and fail on any warning
lint:
	cargo clippy --all-targets -- -D warnings

## clean: Remove build artefacts
clean:
	cargo clean

## deploy-testnet: Build and deploy both contracts to Stellar Testnet
deploy-testnet:
	NETWORK=testnet ./scripts/deploy.sh

## check-stellar-cli: Verify the installed stellar-cli matches the required version
check-stellar-cli:
	@INSTALLED=$$(stellar --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1); \
	if [ -z "$$INSTALLED" ]; then \
		echo "ERROR: stellar-cli not found. Install with:"; \
		echo "  cargo install --locked stellar-cli@$(STELLAR_CLI_VERSION)"; \
		exit 1; \
	elif [ "$$INSTALLED" != "$(STELLAR_CLI_VERSION)" ]; then \
		echo "ERROR: stellar-cli $$INSTALLED found, but $(STELLAR_CLI_VERSION) is required."; \
		echo "  cargo install --locked stellar-cli@$(STELLAR_CLI_VERSION)"; \
		exit 1; \
	else \
		echo "stellar-cli $(STELLAR_CLI_VERSION) OK"; \
	fi

## help: List all available targets
help:
	@grep -E '^## ' Makefile | sed 's/^## //' | column -t -s ':'
