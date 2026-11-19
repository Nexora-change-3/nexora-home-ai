# ComfyUI render adapter

Status: orchestration implementation with injected transport; no live ComfyUI endpoint is configured.

The adapter implements the NEXORA registry render contract and owns the safe orchestration sequence:
1. Accept only backend-resolved source bytes and JPEG/PNG/WebP MIME types.
2. Verify the immutable workflow snapshot against its SHA-256 pin before any upload.
3. Upload the original as a new ComfyUI input; never overwrite it.
4. Clone the pinned API workflow and substitute only configured node inputs.
5. Queue the workflow, poll its history, and require a completed output node.
6. Retrieve the output and store it through NEXORA-owned immutable result storage.
7. Return a terminal result with model/workflow provenance.

## Injected transport boundary

- `uploadImage({ bytes, mimeType, filename, signal }) -> { name }`
- `queuePrompt({ workflow, clientId, signal }) -> { prompt_id }`
- `getHistory(promptId, { signal }) -> ComfyUI history object`
- `getOutput({ filename, subfolder, type }, { signal }) -> Uint8Array`
- `storeResult({ requestId, bytes, mimeType, metadata, signal }) -> { image_ref }`

Every transport method must honor the supplied AbortSignal. The adapter enforces one overall timeout and propagates user cancellation. A transport that ignores AbortSignal may continue work remotely after the adapter returns; a production transport must support request abort and a remote-job interrupt/cancel operation.

No HTTP client, endpoint URL, authentication header, or credential is accepted from a render request. A future production transport must enforce a deployment-configured private host allowlist and server-side authentication.

## Workflow pinning

The factory receives a server-controlled API-format workflow object and its expected `sha256:<64 lowercase hex characters>` digest. The adapter snapshots the workflow and verifies a stable JSON serialization against the digest before uploading any image. The caller cannot supply a workflow URL or replace the pinned graph in a render request.

## Required deployment configuration

- Version-pinned API-format workflow object and independently calculated SHA-256 hash.
- Explicit image, prompt and optional seed node/input mapping.
- Explicit output node ID.
- Model ID and revision.
- Maximum input size, timeout, polling interval, concurrency and retention limits.

## Limitations

- Tested with a fake transport only.
- FireRed's official Hugging Face package publishes a 1.1 ComfyUI workflow file, but it is a ComfyUI UI graph (`nodes` / `links`), not the API-format prompt object required by `POST /prompt`. It must be opened in ComfyUI and exported in API format before its API node IDs and input mappings can be pinned.
- The published graph contains multiple image input nodes. Do not assume it is the single-source workflow needed by NEXORA without checking the official single-image workflow path and graph.
- Cancellation aborts the adapter's in-flight transport call, but remote ComfyUI job interruption still needs explicit transport/runtime support.
- Completed results are idempotent within this adapter instance only. Durable idempotency and crash recovery belong in the NEXORA job store.
- Output MIME is currently recorded as PNG; the configured workflow must guarantee PNG output or the transport contract must return verified MIME metadata.
- No real model inference, GPU provisioning, external photo transfer, Pages/Worker deployment, or Production change has occurred.
