# FireRed 1.1 workflow compatibility audit

Audit date: 2026-11-19

## Verified official workflow sources

There are two distinct artifacts that must not be conflated:

1. **FireRedTeam Hugging Face ComfyUI package**  
   https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI  
   Its README links `firered-image-edit-1.1.json` (revision observed in the earlier inspection: `179def9`). The inspected file is a ComfyUI *frontend* graph (top-level `nodes`, `links`, widget state), not the API prompt object accepted by `POST /prompt`. The linked README describes single- and multi-image workflow material; the particular JSON inspected was the multi-image graph. Do not infer that every FireRed 1.1 graph has multiple image inputs.

2. **Comfy's FireRed Image Edit 1.1 Hub workflow**  
   https://comfy.org/hub/workflows/firered-image-edit-1-1-image-edit-c0198b907108/  
   The page publishes an API-format workflow example. The visible API graph has one `LoadImage` node (ID `143`), one user-facing prompt input (positive text node `167:118`), one `SaveImage` output (node `9`), plus model/encoder/VAE/sampling nodes. The negative text encoder node `167:117` also references the same resized source image. That is not a second uploaded source photo. The SaveImage node consumes the decoded image output `167:126`. This is a single-source-image graph and is a better candidate for NEXORA's one-room-photo path, subject to runtime compatibility verification.

## Critical runtime distinction

The Comfy Hub page's documented code uses `comfy-sdk==0.4.0`, `COMFY_API_KEY`, and `https://cloud.comfy.org`. It explicitly states that this runs on Comfy Cloud, requires a paid Cloud plan and credits, and that each submission can start a paid run. It warns not to automatically retry a submission whose outcome is unknown.

NEXORA's current `comfyui-http-transport.mjs` instead implements the self-hosted ComfyUI HTTP API routes:
- `POST /upload/image`
- `POST /prompt`
- `GET /history/{prompt_id}`
- `GET /view`

These are **not interchangeable integrations**. The current transport is a candidate for a private self-hosted ComfyUI server behind an authenticated reverse proxy. It is not a Comfy Cloud SDK client and must not be pointed at `cloud.comfy.org`. Stock self-hosted ComfyUI does not itself imply the Bearer authentication used by the transport; the deployment must provide a private authenticated gateway/reverse proxy, or the transport must be changed to the actual auth mechanism. Never expose an unauthenticated ComfyUI server publicly.

## What is and is not validated

- The Comfy Hub page proves that a single-image FireRed 1.1 API-format graph is published and documents its node IDs and model assets.
- It does **not** prove that the Hub graph runs unchanged on a self-hosted ComfyUI deployment. Custom node availability, model filenames, LoRA compatibility, ComfyUI version, and API-export behavior must be checked.
- The Hugging Face package graph and Comfy Hub API graph are different artifacts. Do not hash one and configure node mappings from the other.
- NEXORA's mocked transport tests do not validate either real graph or actual FireRed inference.
- No live server, GPU, paid Comfy Cloud credits, or user image was used.

## Required next engineering steps

1. Adopt the Comfy Hub single-image API graph as a **candidate template**, not a proven local workflow.
2. Retrieve the exact downloadable API JSON and pin its immutable revision/hash.
3. Validate the graph structurally: required `class_type` and input names, one original image input, positive/negative prompt mapping, model/LoRA/CLIP/VAE assets, and the configured SaveImage output.
4. Build a local ComfyUI compatibility checklist for every node and asset. Resolve the FireRed 1.1 vs Lightning LoRA version pairing before running.
5. Make the runtime choice explicit: self-hosted private ComfyUI (no cloud credit charge, but GPU host cost) or Comfy Cloud SDK (paid; requires separate explicit approval). Do not mix their clients.
6. Before any user photo is sent, use a synthetic fixture and a real test server only after infrastructure, authentication, retention, and cost have been approved.

## Source

Comfy Hub workflow page, inspected 2026-11-19:
https://comfy.org/hub/workflows/firered-image-edit-1-1-image-edit-c0198b907108/
Relevant facts: single `LoadImage` node `143`; positive prompt node `167:118`; negative text node `167:117`; `SaveImage` node `9`; Comfy SDK example targets paid Comfy Cloud.
