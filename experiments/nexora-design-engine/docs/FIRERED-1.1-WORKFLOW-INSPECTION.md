# FireRed Image Edit 1.1 ComfyUI workflow inspection

Inspection date: 2026-11-19

## Official package found

FireRedTeam's official Hugging Face repository is:
https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI

The model card identifies this package as the ComfyUI adaptation of FireRed Image Edit 1.1, 20B parameters, Apache-2.0. Its README links the workflow file:
https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/blob/main/firered-image-edit-1.1.json

The workflow file's verified upstream revision shown by Hugging Face is `179def9`. The file is about 29.6 kB.

## Critical format finding

The downloaded JSON is the ComfyUI frontend graph format: it contains top-level `nodes`, `links`, `last_node_id` and UI widget state. It is not the API prompt object expected by ComfyUI's `POST /prompt` endpoint. It must be opened in a compatible ComfyUI instance and exported using the API-format workflow export before NEXORA can pin the executable prompt graph.

The graph includes multiple LoadImage nodes and multiple image inputs to Qwen image-edit conditioning. Therefore, it must not be assumed to be the single-source room-photo workflow without verifying the single-image variant.

The model README labels multi-image and single-image workflow sections, but the repository's linked JSON inspected here is the multi-image graph. The single-image graph's downloadable file was not identified from the README content.

## Consequence for NEXORA

- Do not guess API node IDs from the UI graph.
- Do not convert the UI graph to API format by hand and assume the widget mapping is correct.
- Next required step: obtain the official single-image workflow (if published), load it into a ComfyUI environment with matching nodes/models, export API format, inspect the resulting class_type/input graph, calculate SHA-256, and add the pinned API graph plus explicit node map to the experiment branch.
- Until that export exists, the render adapter remains correctly transport-mocked and cannot be pointed at a live model.

## Source references

- FireRedTeam official model card and workflow package: https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI
- Official README raw content: https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/raw/main/README.md
- Official workflow JSON raw content: https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1-ComfyUI/raw/main/firered-image-edit-1.1.json
- Hugging Face workflow file revision: `179def9`

No GPU/runtime was started and no user photo was uploaded.
