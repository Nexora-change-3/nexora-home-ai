# ComfyUI render adapter

Status: orchestration implementation with injected transport; no live ComfyUI endpoint is configured.

The adapter implements the NEXORA registry render contract and owns the safe orchestration sequence:
1. Accept only backend-resolved source bytes and JPEG/PNG/WebP MIME types.
2. Upload the original as a new ComfyUI input; never overwrite it.
3. Clone the server-pinned API workflow and substitute only configured node inputs.
4. Queue the workflow, poll its history, and require a completed output node.
5. Retrieve the output and store it through NEXORA-owned immutable result storage.
6. Return a registry-compatible terminal result with model/workflow provenance.

## Injected transport boundary

The adapter receives a transport with these methods:
- `uploadImage({ bytes, mimeType, filename }) -> { name }`
- `queuePrompt({ workflow, clientId }) -> { prompt_id }`
- `getHistory(promptId) -> ComfyUI history object`
- `getOutput({ filename, subfolder, type }) -> Uint8Array`
- `storeResult({ requestId, bytes, mimeType, metadata }) -> { image_ref }`

No HTTP client, endpoint URL, authentication header, or credential is accepted from a render request. A future production transport must enforce a deployment-configured private host allowlist and server-side authentication.

## Required deployment configuration

- Version-pinned API-format workflow object and its independently verified SHA-256 hash.
- Explicit image, prompt and optional seed node/input mapping.
- Explicit output node ID.
- Model ID and revision.
- Maximum input size, timeout, polling interval, concurrency and retention limits.

The current adapter deliberately does not guess FireRed workflow node IDs. Those must be read from and pinned to the official exported API workflow before configuring a real runtime.

## Limitations

- This implementation is tested with a fake transport only.
- Cancellation stops further polling when the signal is observed; it does not yet call a ComfyUI-specific interrupt endpoint.
- Completed results are idempotent within the adapter instance only. Durable idempotency and crash recovery belong in the NEXORA job store.
- Output MIME is currently recorded as PNG; the configured workflow must guarantee PNG output or the transport contract must be extended to return verified MIME metadata.
- No real model inference, GPU provisioning, external photo transfer, Pages/Worker deployment, or Production change has occurred.
