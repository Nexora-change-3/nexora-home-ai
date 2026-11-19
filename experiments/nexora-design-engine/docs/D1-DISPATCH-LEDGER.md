# NEXORA durable render dispatch ledger

## Purpose

Prevent a repeated render request from creating a second ComfyUI job when the first `/prompt` submission may have been accepted but its response was lost. The ledger is keyed by `request_id` and persists the source image reference, pinned workflow hash, dispatch state, ComfyUI `prompt_id`, and final immutable result reference.

## State model

- `submitting`: atomically claimed before the `/prompt` POST. If the process stops here, treat the outcome as unknown; never auto-submit again.
- `outcome_unknown`: the POST failed before a trustworthy acknowledgement. Requires reconciliation; no automatic retry.
- `queued`: ComfyUI returned a `prompt_id`. A future recovery worker can poll this exact job instead of submitting another.
- `succeeded`: stores the final result JSON. Repeated calls with the same request ID, source reference, and workflow hash return that result.

A request ID reused with a different source image or workflow hash is rejected.

## Implementation

- `model-adapters/dispatch-ledger.mjs` exposes a store contract and an in-memory implementation for tests.
- `createD1DispatchStore(env.DB)` implements the same contract using atomic `INSERT OR IGNORE` and conditional state updates.
- `migrations/0001_render_dispatch_ledger.sql` creates the unique request key and state index.
- The render adapter claims the request immediately before queue submission, records the returned prompt ID, and persists successful results.

## Binding and deployment status

This is implemented as an adapter and migration, but **not connected to a live Cloudflare D1 database**. No D1 database was created, no binding was added, and no Worker/Pages deployment was performed. The current default is in-memory and therefore does not survive process restart. To enable durable operation later, a separately approved D1 database must be bound as `DB`, the SQL migration applied, and the adapter constructed with `dispatchStore: createD1DispatchStore(env.DB)`.

No credentials, image bytes, signed URLs, or prompt contents are stored in the ledger. The source image reference is retained as a stable internal identifier.

## Recovery limitation

A `queued` record retains `prompt_id`, which is enough to poll the existing ComfyUI history endpoint. This commit does not yet implement a background recovery worker or operator reconciliation UI. `submitting` and `outcome_unknown` records deliberately remain blocked until that reconciliation is implemented. This favors avoiding duplicate paid inference over automatic recovery.

## Validation

Tests cover store recreation against a shared D1-compatible fake binding, atomic duplicate claims, state transitions, result persistence, request-ID conflicts, and adapter recreation after an ambiguous queue submission. These are unit/contract tests, not a live D1 integration test.


## Recovery API

`adapter.recover(requestId, { signal })` resumes only a ledger row in `queued` state with a saved ComfyUI `prompt_id`. It polls that exact history entry, fetches the existing output and stores a new immutable NEXORA result; it never uploads the source or calls `/prompt` again. A `succeeded` row returns its saved result. Missing rows, `submitting` and `outcome_unknown` rows fail closed and require reconciliation.

The recovery method is implemented and covered by mocked adapter tests. It is not yet a scheduled/background recovery worker. The in-memory default is not durable; D1 must be separately provisioned and bound before process-restart recovery is available. Concurrent recovery across multiple Worker instances is not yet protected by a lease, so production scheduling must wait for an atomic recovery-claim design and live D1 tests.
