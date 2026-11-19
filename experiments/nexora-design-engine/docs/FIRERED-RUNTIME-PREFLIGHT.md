# FireRed 1.1 runtime preflight

The NEXORA experiment now has a read-only preflight against a **real self-hosted ComfyUI instance**. It uses the documented endpoints `GET /object_info`, `GET /models/{folder}`, and `GET /system_stats` before any render is queued.

- `/object_info` checks every node class in the pinned 22-node API graph and compares required input names with the graph's supplied inputs.
- `/models/{folder}` checks the exact transformer, Lightning LoRA, Qwen text encoder and VAE filenames in `diffusion_models`, `loras`, `text_encoders`, and `vae` respectively.
- `/system_stats` records the ComfyUI, Python and PyTorch versions in the report.
- Experimental node metadata is surfaced as a warning/status, not silently ignored.
- Missing nodes, required inputs, or model files make the report incompatible/incomplete. The caller must not submit a render when `compatible` is false.

The transport exposes only fixed read-only GET methods for this preflight. The model folder argument is allowlisted. The preflight does not upload an image, queue a prompt, download an output, or incur GPU generation cost.

Important: this is now executable compatibility-checking code, but **no actual ComfyUI host is connected in this repository test run**. CI uses a deterministic fixture. Runtime compatibility remains unverified until a private authenticated ComfyUI host is configured and its live endpoint responses are inspected. The FireRed adapter must be gated on a successful report before it is used.

Source for endpoint behavior: ComfyUI core `server.py` and Comfy-Org API route documentation. See https://github.com/Comfy-Org/ComfyUI/blob/master/server.py and https://github.com/Comfy-Org/docs/blob/main/development/comfyui-server/comms_routes.mdx.
