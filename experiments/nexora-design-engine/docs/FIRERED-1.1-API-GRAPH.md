# FireRed 1.1 API graph: NEXORA inspection

Inspection date: 2026-11-19

## Source and format

The source is Comfy's official FireRed Image Edit 1.1 workflow page:
https://comfy.org/hub/workflows/firered-image-edit-1-1-image-edit-c0198b907108/

The page's **Download API JSON** link exposes an API prompt graph, not the regular ComfyUI frontend workflow JSON. The graph embedded in the page's API example and the downloadable API JSON use node IDs in the same form. The NEXORA template in `workflows/firered-image-edit-1.1-api.json` is an adapted copy of that graph: only the demo image filename, demo prompt and output filename prefix are replaced with neutral NEXORA placeholders. Node classes, model asset names and node wiring are retained.

The file is intended for the ComfyUI HTTP `/prompt` API shape. It is **not** the multi-image frontend graph from the separate Hugging Face ComfyUI package, and it is **not** a Comfy Cloud SDK client payload.

## Verified graph structure

- 22 API nodes.
- Exactly one external `LoadImage`: node `143`, input `image`.
- The source flows through `FluxKontextImageScale` node `167:147`.
- Both text encoders (`167:118` positive and `167:117` negative) reference that same scaled source image. This is repeated conditioning on one image, not two independent source uploads.
- The positive prompt is node `167:118`, input `prompt`.
- Seed is node `167:130`, input `seed`.
- Output is `SaveImage` node `9`, fed by `VAEDecode` node `167:126`.
- The graph includes `ComfySwitchNode` nodes controlling Lightning LoRA, steps and CFG. Lightning is enabled by default (8 steps); the alternate path is 40 steps with CFG 4.
- Assets named by the graph:
  - `FireRed-Image-Edit-1.1-transformer.safetensors`
  - `FireRed-Image-Edit-1.0-Lightning-8steps-v1.0.safetensors`
  - `qwen_2.5_vl_7b_fp8_scaled.safetensors`
  - `qwen_image_vae.safetensors`

Canonical stable JSON SHA-256 for the checked-in template (recursive sorted-key serialization): `sha256:d9f3600d63a05457eb1b9126d37f16cf69ca3cb016b8dadc388feaf9b5bc5f2d`.

## NEXORA mappings

```js
{
  image: { node_id: "143", input_name: "image" },
  prompt: { node_id: "167:118", input_name: "prompt" },
  seed: { node_id: "167:130", input_name: "seed" },
  outputNodeId: "9"
}
```

The validator in `model-adapters/validate-firered-workflow.mjs` checks API format, graph references, single-source path, prompt conditioning, output path and exact asset filenames. It deliberately rejects a second external `LoadImage` node and frontend-format JSON.

## Compatibility boundary — not yet verified

This graph has been inspected and structurally validated, but it has **not** been executed against a local ComfyUI server. In particular, local availability and version compatibility of `ComfySwitchNode`, `TextEncodeQwenImageEditPlus`, `FluxKontextImageScale`, model files, the 1.0 Lightning LoRA paired with the 1.1 transformer, and the current ComfyUI version remain to be verified.

The Comfy page's code example runs on `https://cloud.comfy.org`, requires a paid Cloud plan and credits, and warns not to automatically retry submissions with unknown outcomes. NEXORA's existing HTTP transport uses the self-hosted ComfyUI routes (`/upload/image`, `/prompt`, `/history`, `/view`) and must **not** be pointed at Comfy Cloud. No Cloud API key, paid endpoint, GPU host, or runtime has been provisioned.

## Safety and next gate

1. Keep this graph and validator in the experiment branch.
2. Verify a private, authenticated local ComfyUI runtime and required node/model inventory without uploading a user photo.
3. Validate the graph against that runtime's `/object_info` and perform a synthetic fixture test.
4. Confirm compute cost, retention, location and privacy before any real photo is sent.
5. Only after these gates and explicit approval, test on the user's original kitchen photo. The original remains immutable; no internet image or generated substitute is an accepted benchmark.

No V1, V2, Pages or Production files were changed by this work.


## Core node evidence checked on 2026-11-19

The relevant node implementations are present in the current official ComfyUI source tree:

- \`TextEncodeQwenImageEditPlus\` is implemented in \`comfy_extras/nodes_qwen.py\` and accepts \`image1\`, \`image2\`, and \`image3\` as optional conditioning images. NEXORA supplies the same single source through \`image1\` in both encoder nodes.
- \`FluxKontextImageScale\` is implemented in \`comfy_extras/nodes_flux.py\`.
- \`ComfySwitchNode\` is implemented in \`comfy_extras/nodes_logic.py\` and is marked experimental in its schema.

This confirms that these node classes exist in current ComfyUI core; it does not establish that an arbitrary older self-hosted installation has the required version or that all model files load. The runtime gate remains: pin a ComfyUI release/commit, query that server's \`/object_info\`, verify all node schemas and assets, then run a synthetic image before any user photo.
