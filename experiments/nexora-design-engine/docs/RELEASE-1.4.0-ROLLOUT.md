# Release 1.4.0 rollout and rollback

- Active Worker: `nexora-design-engine`, active release 1.2.1.
- Candidate: version 1.4.0, Cloudflare Worker version 7, inactive preview.
- Candidate preview URL: `https://83593bb0-nexora-design-engine.audiliga.workers.dev/`.
- Candidate binds Workers AI (`AI`) and Design Engine D1 (`DB`). Migration 0004 is applied.
- The stable workers.dev URL and its active deployment have not been changed.

## Promotion gates

1. Wait for the daily free neuron allocation to reset.
2. Submit a public technical kitchen fixture to `/api/concepts`; confirm Moondream and Llama return three valid, distinct concepts and D1 stores the session.
3. Render the three concepts once each; verify FLUX.2 Dev output decoding, room-identity check, D1 persistence and result retrieval. Do not retry ambiguous submissions.
4. Inspect visual results for substantial design changes, geometry preservation, functionality and realism. The current automated room-identity check is not a complete visual-quality score.
5. When original-photo access returns, repeat the comparison on the user's own photograph before production promotion.

## Promotion and rollback

- Promote only the tested version ID through a Cloudflare Worker deployment; do not replace the Worker script blindly.
- Keep the previous 1.2.1 version and deployment for immediate rollback.
- Verify the stable URL, `/api/health`, concept endpoint, render endpoint and browser IndexedDB save after promotion.
- Never modify V1/V2 Pages projects or their Workers.
- No paid plan, GPU rental, credits or paid fallback.
