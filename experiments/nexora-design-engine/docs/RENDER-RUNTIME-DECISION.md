# Render Runtime Decision — FireRed Image Edit 1.1

Status: research decision, not a deployed integration.

Date: 2026-11-19

## Decision

Use ComfyUI as the first execution interface to prototype FireRed Image Edit 1.1. Keep the NEXORA application and Design Engine provider-neutral. Do not bind the application directly to a model vendor API.

The first implementation target is a ComfyUI-compatible HTTP client behind the existing model-adapter contract. A deployment/runtime is not selected or provisioned yet.

## Evidence checked

- The official FireRed 1.1 model card describes a 20B-parameter image-to-image model and currently reports that no Hugging Face Inference Provider hosts it:
  https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1
- The official FireRed ComfyUI model package publishes a 1.1 ComfyUI workflow and GGUF quantizations:
  https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI
- Comfy's workflow hub has a FireRed Image Edit 1.1 workflow and lists its model assets:
  https://comfy.org/hub/workflows/firered-image-edit-1-1-image-edit-c0198b907108/
- ComfyUI's server exposes HTTP routes for image upload, prompt submission, history retrieval and output viewing:
  https://github.com/Comfy-Org/docs/blob/main/development/comfyui-server/comms_routes.mdx
- ComfyUI API workflows must be exported in API format, not the normal editable UI workflow format:
  https://github.com/Comfy-Org/docs/blob/main/development/api-development/workflow-api-format.mdx
- Comfy API can package a workflow and run it as a managed GPU endpoint, but its documentation states that it is available on paid Comfy plans:
  https://support.comfy.org/articles/2703236295-comfy-api-deploy-your-comfyui-workflow-as-an-api

## Runtime options

### A. Self-hosted ComfyUI

- Best for controlled experiments and keeping the image path under our control.
- Requires a separate machine or GPU host; an ordinary Cloudflare Worker is not the model runtime.
- The ComfyUI process must be reachable privately by the NEXORA backend. Do not expose an unauthenticated ComfyUI port to the public internet.
- No machine or GPU has been provisioned as part of this work.

### B. Managed Comfy API / Comfy Cloud

- The official Comfy workflow makes FireRed 1.1 a plausible managed-runtime candidate.
- Comfy API is a paid managed-GPU product. No deployment, subscription, credit purchase or paid job is authorized by this decision.
- Before considering it, obtain a written estimate for build/storage/endpoint/GPU usage, idle billing, region, retention and image-data handling. User approval is required.

### C. Generic hosted inference API

- Not currently a viable FireRed 1.1 shortcut: its Hugging Face model card reports no Inference Provider deployment.
- Recheck provider availability before selecting any hosted endpoint.

## Resource caution

The model is 20B parameters. Community hardware estimates for quantized FireRed 1.1 vary substantially depending on whether the text encoder and other components are kept in GPU memory or offloaded. Treat any VRAM number as a planning estimate, not a guaranteed minimum. Measure the exact ComfyUI workflow on the selected hardware before committing.

The Q4 GGUF weights are approximately 13 GB on disk; that is not the same as peak runtime memory. The workflow also requires its text encoder and VAE assets.

## NEXORA integration boundary

1. Browser sends the original image to the NEXORA backend; the browser must not receive GPU credentials.
2. Backend validates user ownership, image type/size, consent and the structured design brief.
3. Backend stores the original immutably and creates a render job.
4. A private ComfyUI adapter uploads the input image and submits a version-pinned API-format workflow.
5. Adapter tracks the returned prompt ID and reads completion history/output.
6. NEXORA stores the generated image as a new result; it never overwrites the original.
7. Quality Gate evaluates the result and marks it for human review.

The adapter must support cancellation, timeout, retry policy, request correlation, model/workflow version metadata, and sanitized errors. Never log image bytes, credentials, or signed URLs.

## Acceptance gates before any real user photo

- Reproducible FireRed 1.1 workflow with exact model and node versions pinned.
- Runtime health check and authenticated private network path.
- Confirmed compute cost and data retention terms.
- Test using non-user synthetic fixtures first.
- Verify image upload, queue submission, completion, output retrieval, timeout and cancellation.
- Only after these gates and explicit user consent may the user's original photo be submitted.
- Compare all concepts against the same original photo and use the existing Quality Gate; no recolour-only result is accepted as a successful design.

## Explicit non-actions

- No Cloudflare Worker or Pages deployment.
- No GPU instance or paid Comfy API endpoint created.
- No user photograph sent to an external model.
- No changes to V1, V2 or Production.
- No claim that FireRed has been integrated or tested.
