# FireRed Turbo smoke-test result

Date: 2026-11-19

## Confirmed real generations

Two independent smoke generations completed with the same pinned public model variant and a public-domain kitchen fixture.

### Python Gradio Client path
- Run: https://github.com/Nexora-change-3/nexora-home-ai/actions/runs/44583443303
- Artifact: `firered-smoke-output` (artifact ID `14560252031`).
- Result: valid PNG returned by real model inference.
- Dimensions: 768 × 512.
- Seed: 42.

### NEXORA JavaScript adapter path
- Run: https://github.com/Nexora-change-3/nexora-home-ai/actions/runs/44585972447
- Artifact: `firered-smoke-output` (artifact ID `14560183080`).
- Result: the NEXORA JavaScript transport completed Gradio queue submission, sse_v3 event streaming, output retrieval and PNG validation.
- Dimensions: 768 × 512.
- Seed: 42.
- Adapter elapsed time: 10,097 ms.
- This is the first confirmed live end-to-end execution through the NEXORA JavaScript adapter.

Both runs used a public-domain Wikimedia Commons kitchen image solely for technical smoke testing. Neither used the user's photo; neither is a design-quality acceptance test.

## Exact model provenance

The successful Space is an experimental third-party pipeline, not the unmodified official FireRed checkpoint:

- Space: `someone-in-the-world/FireRed-Experimental-Turbo`
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

- Added a pinned Gradio sse_v3 transport and FireRed Turbo adapter in the experiment branch.
- The JavaScript transport has now passed a real live run against the pinned public Space revision.
- Mocked transport/adapter tests pass in the non-deploying Design Engine CI: https://github.com/Nexora-change-3/nexora-home-ai/actions/runs/44585837442
- The adapter uses the existing dispatch/recovery contract, stores both Gradio event_id and session_hash, and does not retry ambiguous queue submissions.
- Adapter remains intentionally registered as `planned`, not `ready`, because the runtime is a public third-party Space and its data retention/privacy terms have not been approved for private room photos.
- Explicit provider-specific consent is required before any source image is sent to the public Hugging Face Space.

## Storage and deployment boundary

- Created isolated Cloudflare D1 database `nexora-design-engine-experiment` in the EU jurisdiction.
- Applied migrations `0001_render_dispatch_ledger.sql` and `0002_recovery_leases.sql`.
- The D1 database is not yet bound to a Worker; no Worker or Pages deployment was made for this experiment.
- No paid GPU, Comfy Cloud, paid endpoint, or subscription was created.
- No user photo was uploaded to any external service.
- NEXORA V1, V2, and Production were not modified or redeployed.

## Next gates

1. Complete the isolated Worker and bind the D1 ledger plus private result storage without touching V1/V2/Production.
2. Add explicit UI consent for third-party image processing before allowing a personal room photo to leave the NEXORA environment.
3. Verify rate limits, retention, output storage and recovery against the public Space before marking the adapter ready.
4. Use the user's original photo only when her upload access is available and external-processing consent is explicit.
5. Evaluate geometry preservation, style fidelity, photorealism, functional layout and concept diversity before promoting this model.
