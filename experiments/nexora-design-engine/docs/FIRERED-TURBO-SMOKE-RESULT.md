# FireRed Turbo smoke-test result

Date: 2026-11-19

## Confirmed first real generation

- GitHub Actions run: https://github.com/Nexora-change-3/nexora-home-ai/actions/runs/44583443303
- Artifact: `firered-smoke-output` (artifact ID `14560252031`), retained for 7 days from the run.
- Result: one real model inference completed and returned a valid PNG.
- Output dimensions: 768 × 512.
- Seed: 42.
- Runtime: public Hugging Face ZeroGPU Space `someone-in-the-world/FireRed-Experimental-Turbo`.
- Input: a public-domain Wikimedia Commons kitchen image, used only to test the technical generation path. It is not the user's photo and is not a design-quality acceptance test.

## Exact model provenance

The successful Space is an experimental third-party pipeline, not the unmodified official FireRed checkpoint:

- Space revision: `91b831cc23f0ee770fc2d9c80a4619339a245275`
- Base pipeline: `FireRedTeam/FireRed-Image-Edit-1.1` at `3bc3f2a12722fd9883eb6357500de191d56baaf5`
- Transformer variant: `prithivMLmods/Qwen-Image-Edit-Rapid-AIO-V23` at `11b8c8c31ded785239679a73dd93c194cf21b1f1`
- Mode: fast, 3 steps, 120-second ZeroGPU allocation.

Do not describe this as an official FireRed 1.1 checkpoint or a proven interior-design winner.

## Other free endpoints checked

- Official `FireRedTeam/FireRed-Image-Edit-1.1` Space: API connection and schema inspection succeeded, but the inference endpoint returned a generic runtime error.
- `ysharma/fast-image-studio`: uses a FireRed 1.1 pipeline with a different Rapid-AIO transformer, but the live inference attempt failed in the upstream GPU runtime with an NVML/PyTorch error.
- These failures do not establish that the underlying model weights are unusable; they establish that those public runtimes were not reliable in the tested sessions.

## NEXORA integration status

- Added a pinned Gradio HTTP transport and a FireRed Turbo adapter in the experiment branch.
- Adapter requires explicit provider-specific consent before any source image can be sent to the public Hugging Face Space.
- The adapter is intentionally registered as `planned`, not `ready`.
- Mocked transport/adapter tests pass in the non-deploying Design Engine CI: https://github.com/Nexora-change-3/nexora-home-ai/actions/runs/44585097026
- A direct live JavaScript transport attempt reached the Space queue but ended in an upstream SSE error. The Python `gradio_client` smoke path is the only live generation confirmed so far. Do not deploy or enable the JavaScript adapter until its live HTTP path is verified.
- The adapter uses the existing dispatch/recovery contract and does not retry ambiguous queue submissions.

## Storage and deployment boundary

- Created isolated Cloudflare D1 database `nexora-design-engine-experiment` in the EU jurisdiction.
- Applied migrations `0001_render_dispatch_ledger.sql` and `0002_recovery_leases.sql`.
- The D1 database is not yet bound to a Worker; no Worker or Pages deployment was made for this experiment.
- No paid GPU, Comfy Cloud, paid endpoint, or subscription was created.
- No user photo was uploaded to any external service.
- NEXORA V1, V2, and Production were not modified or redeployed.

## Next gates

1. Verify the direct JavaScript Gradio HTTP/SSE protocol against the pinned Space revision.
2. Decide whether the user explicitly consents to sending a personal room photo to this public third-party Space. Without consent, keep personal-photo rendering disabled.
3. Bind D1 and result storage only to a new isolated experiment Worker after the adapter and access controls are verified.
4. Run the same prompt pipeline against the user's original photo only when her upload access is available and the external-processing consent is explicit.
5. Evaluate room geometry preservation, style fidelity, photorealism, functional layout, and concept diversity before promoting any model.
