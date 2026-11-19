# ComfyUI Render Adapter Contract

Status: implementation specification; no live ComfyUI endpoint is configured.

## Responsibility

Translate the NEXORA render request into a version-pinned ComfyUI API workflow, submit it to a private ComfyUI-compatible endpoint, track the job, and return an immutable result reference.

The adapter is a transport/runtime integration. It does not decide design concepts and does not bypass the Quality Gate.

## Required configuration

- Private base URL, supplied by deployment configuration.
- Authentication mechanism supported by the selected ComfyUI host; never hardcode credentials.
- API-format workflow JSON pinned by version/hash.
- Explicit node-ID mapping for source image, prompt, seed, model and output node.
- Allowed input MIME types and maximum upload size.
- Request timeout, polling interval, maximum poll duration and retry policy.

Do not accept an arbitrary URL or workflow JSON from an end user.

## Request mapping

Input must satisfy the shared adapter registry request shape:

- `request_id`: stable NEXORA job identifier.
- `source_image_ref`: backend-owned immutable source image reference.
- `design_brief`: validated concept brief, not free-form untrusted workflow data.
- `safety_policy`: preservation and review constraints.

The backend resolves `source_image_ref` to bytes. The adapter must not fetch arbitrary URLs supplied by a client.

## ComfyUI protocol stages

1. Upload source image using the ComfyUI image-upload route.
2. Substitute the returned server-side image name into the pinned API-format workflow.
3. Submit the workflow to the prompt queue and record the returned `prompt_id`.
4. Poll the job history or consume authenticated WebSocket events until completion, failure or timeout.
5. Resolve output node metadata and retrieve the output image.
6. Store the output in NEXORA-owned storage as a new immutable object.
7. Return `request_id`, terminal status, output reference, model/workflow provenance and timing metadata.

Relevant upstream protocol documentation:
- HTTP and WebSocket routes: https://github.com/Comfy-Org/docs/blob/main/development/comfyui-server/comms_routes.mdx
- API workflow format: https://github.com/Comfy-Org/docs/blob/main/development/api-development/workflow-api-format.mdx

## Security requirements

- ComfyUI must be private or protected by an authenticated gateway.
- Never expose ComfyUI credentials or endpoint URLs to the browser.
- Enforce outbound host allowlists; no user-controlled URL fetches.
- Limit file size and verify MIME type from bytes, not filename alone.
- Do not overwrite the source image.
- Sanitize upstream errors and avoid logging prompts containing personal data, image bytes, tokens or signed URLs.
- Add per-user concurrency and cost limits before enabling paid compute.
- Delete temporary upstream files according to the approved retention policy.

## Terminal result

A successful response includes:
- the same `request_id` as the input,
- `status: "succeeded"`,
- a backend-owned `image_ref`,
- model ID and revision,
- workflow hash,
- elapsed time.

A failed or timed-out job must return a terminal failure status and sanitized error code. A queue acknowledgement alone is not a successful render.

## Tests required

- Successful upload â queue â history â output round trip using a fake ComfyUI server.
- Queue validation failure.
- Upstream authentication failure.
- Missing output node/image.
- Timeout and cancellation.

### Cancellation safety

Stock ComfyUI's `POST /interrupt` stops the current server execution; it is not a safe per-job cancellation primitive for a shared worker. The NEXORA transport therefore removes only the specified pending prompt through `POST /queue` with `delete: [prompt_id]` and never calls `/interrupt`.

If a prompt is already running, NEXORA may stop waiting locally, but must not claim that GPU execution stopped. A true running-job cancellation requires a dedicated isolated ComfyUI worker for that job, or a provider API with verified per-job cancellation semantics. Do not share a worker and send a global interrupt.
- Duplicate request handling / idempotency.
- No source-image overwrite.
- URL allowlist and MIME/size validation.
- Ensure no secret or image bytes appear in logs.

No production integration is implied by this specification.
