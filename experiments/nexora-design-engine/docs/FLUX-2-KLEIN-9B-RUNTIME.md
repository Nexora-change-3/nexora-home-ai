# NEXORA Design Engine 1.2.1 — runtime decision

## Active image engine

- Provider: Cloudflare Workers AI (account-bound AI binding).
- Model: `@cf/black-forest-labs/flux-2-klein-9b` (FLUX.2 Klein 9B).
- Output: 1024×768, guidance 5.5; the model uses its fixed distilled inference schedule.
- The model was exercised against a public kitchen fixture. Prompt-only architectural-minimalist and warm-Mediterranean directions, plus a walnut/stone reference-guided direction, produced visibly different cabinetry/material treatments while retaining the room type. This is not a claim of pixel-perfect geometry preservation.

## Free-usage protection

- The application enforces a hard account-wide limit of 3 render requests per UTC day, plus a per-IP limit of 3.
- No paid fallback, Comfy Cloud, paid GPU endpoint, or external Hugging Face inference provider is configured.
- If the Cloudflare free daily allocation is exhausted, the request fails closed with a quota message. It is never redirected to a paid provider.
- Moondream performs a source/result room-identity check before a result is accepted. A room-type mismatch or ambiguous classification rejects the image.

## Privacy and recovery

- The source image is sent to Cloudflare Workers AI for rendering and to Moondream for room-identity QA.
- NEXORA does not persist source image bytes server-side. The browser keeps the source in local IndexedDB.
- Accepted result images are stored in D1 for 24 hours.
- Dispatch IDs are idempotent. A synchronous model call with an uncertain outcome is not resubmitted automatically. If an image was stored before the dispatch commit, recovery completes the existing record from D1.

## Limits

FLUX.2 Klein 9B is the best available no-paid-runtime baseline validated in this environment. It can still simplify details or preserve too much of the source. The three concept prompts are deliberately separated by cabinetry form, materials, island treatment and lighting. The first release must still be validated on the user's own original room photo before claiming professional design quality.
