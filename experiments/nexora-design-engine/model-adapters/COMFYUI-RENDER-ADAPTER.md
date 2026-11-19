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
- `uploadImage({ bytes, mimeType, filename, signal }) -> { name }`
- `queuePrompt({ workflow, clientId, signal }) -> { prompt_id }`
- `getHistory(promptId, { signal }) -> ComfyUI history object`
- `getOutput({ filename, subfolder, type }, { signal }) -> Uint8Array`
- `storeResult({ requestId, bytes, mimeType, metadata, signal }) -> { image_ref }`

Every transport method must honor the supplied AbortSignal. The adapter enforces one overall timeout and propagates user cancellation to in-flight operations. A transport that ignores AbortSignal may continue work remotely after the adapter returns; a production transport must therefore support request abort and the runtime should expose an explicit remote-job interrupt/cancel operation.

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
- Cancellation aborts the adapter's in-flight transport call, but remote ComfyUI job interruption still needs an explicit transport/runtime capability.
- Completed results are idempotent within the adapter instance only. Durable idempotency and crash recovery belong in the NEXORA job store.
- Output MIME is currently recorded as PNG; the configured workflow must guarantee PNG output or the transport contract must be extended to return verified MIME metadata.
- No real model inference, GPU provisioning, external photo transfer, Pages/Worker deployment, or Production change has occurred.
