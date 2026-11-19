# NEXORA Design Engine 1.2.1 — release record

## Stable address

https://nexora-design-engine.audiliga.workers.dev/

This is a separate Worker. NEXORA V1, V2, Production, Pages projects and their deployments were not modified. The previous experimental Worker alias has been disabled; its script remains available for rollback.

## Runtime

- Image model: Cloudflare Workers AI `@cf/black-forest-labs/flux-2-klein-9b`.
- Room-identity QA: Cloudflare Workers AI Moondream 3.1.
- Output: 1024×768 JPEG/PNG, stored as a new immutable result.
- Result storage: Cloudflare D1 for 24 hours; browser IndexedDB is the persistent user copy.
- Daily limit: 3 render requests across the whole app and 3 per IP.
- Paid fallback: disabled. If the free daily allocation is exhausted, the app stops with HTTP 429.

## Design directions

1. Architectural minimalism — seamless ivory cabinetry, full-height flush pantry, pale limestone island and bookmatched travertine.
2. Warm Mediterranean contemporary — muted olive cabinetry, smoked-oak fluting, warm travertine, curved island and aged bronze.
3. Expressive walnut and stone — deep smoked-walnut storage wall, waterfall pale-stone island, backlit shelves and bronze/dark-metal details.

## Verification

- 165 unit tests pass; GitHub Actions run 44602396470 completed successfully.
- Stable root page, `/api/health` and `/api/concepts` were verified after deployment.
- FLUX.2 Klein 9B was exercised on public kitchen fixtures. It produced visibly distinct material and cabinetry directions; this is not a pixel-level geometry guarantee.
- The first end-to-end `/api/render` attempt on the stable Worker was blocked by the account's exhausted free daily AI allocation. It returned a known quota error, no output was stored, and no paid service was used. The release now returns an explicit 429 and does not offer a false recovery action for a known quota stop.
- The user's original photograph has not been uploaded or processed. The first acceptance test on that photograph remains pending until upload access is available.

## Known limitations

- FLUX.2 Klein 9B is a compact, fixed-step model; it can simplify details or preserve too much of the source.
- Moondream currently checks room-type identity, not exact window/wall geometry or pixel-level design quality.
- The three concept plans are structured deterministic directions, not yet a fully autonomous AI designer.
- No paid GPU, Comfy Cloud, paid inference endpoint or paid fallback is configured.
