# FLUX.2 Dev — основной графический адаптер NEXORA

## Рабочая конфигурация
- Provider: Cloudflare Workers AI (`env.AI`).
- Model: `@cf/black-forest-labs/flux-2-dev`.
- Model adapter: `model-adapters/workers-ai-flux2-dev-adapter.mjs`.
- Inference: 16 steps, guidance 4.5, seed persisted; output 1024×768.
- Input: browser creates a JPEG derivative with the longest side at most 512 px. The original photo stays in browser IndexedDB and is never overwritten.
- Result: stored as a new immutable D1 object, then copied to browser IndexedDB.
- Quality gate: Moondream 3.1 classifies both source and result; a room-type change or uncertain classification blocks acceptance.
- Dispatch: D1 idempotency ledger. Unknown submissions are never automatically repeated.
- Free cap: application limits to 1 design session and 3 render calls per UTC day; Workers AI may impose the account's shared daily 10,000-neuron free allocation earlier. There is no paid fallback.

## Required Cloudflare bindings
`wrangler.toml` declares `AI` (Workers AI) and `DB` (the isolated experiment D1 database). Migrations `0001`–`0004` belong to the Design Engine database; `0004_design_sessions.sql` has been applied. Do not point this database at V1/V2 data. Do not point this project at V1, V2, or Production databases.

## Operational limits
FLUX.2 Dev is a higher-capability candidate than FLUX.2 Klein 9B, but it has not yet passed a live render in this account because the daily free neuron allocation was exhausted during earlier model probes. No paid plan or credit purchase is enabled. The first live check after the free allocation resets must verify: model call, output decoding, Moondream gate, D1 persistence, local IndexedDB save, and three distinct concepts on the same source photo.

The 512 px input limit constrains fine detail. It is an upstream model constraint, not a reason to upscale the source and claim additional detail.
