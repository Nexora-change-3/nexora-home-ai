# No-payment runtime decision — FireRed 1.1

Status: research and design only. No account creation, GPU provisioning, payment method, credits, endpoint, or user-photo upload.

## Decision

Do not provision a GPU runtime yet. Continue with offline code, workflow validation, fake-server integration tests, and privacy/security design. The current FireRed adapter targets a private self-hosted ComfyUI HTTP API. It is not a Comfy Cloud SDK client.

## Published reference prices (checked 2026-11-19)

| Option | GPU reference | Persistent storage | Billing model | Fit for NEXORA |
|---|---:|---:|---|---|
| RunPod Secure Cloud | L40S 48 GB: $1.09/hour | Standard network storage: $0.07/GB/month under 1 TB | GPU time plus storage and other infrastructure | Closest match to current self-hosted ComfyUI transport, subject to private networking and gateway setup |
| Modal Starter | L40S: $0.000542/second (about $1.95/hour) | Volumes: $0.09/GiB/month; published first 1 TiB/month free allowance | Usage-based; Starter lists $30/month compute credits | Good serverless option; would need a Modal-native HTTP service and separate adapter/runtime integration |
| Comfy Cloud Custom Build | RTX PRO 6000 96 GB: $3.49/hour | $0.20/GB/month | GPU seconds plus model storage; plan/credits apply | Convenient Comfy-managed runtime, but requires a separate Comfy SDK/API transport rather than the current local ComfyUI HTTP transport |

These are published list prices, not a quote or a guarantee of FireRed compatibility. They exclude applicable taxes, data transfer, setup time, image storage, and other platform charges. RunPod Secure Cloud GPU pricing is the relevant reference; Community Cloud may be cheaper but is not the privacy-first choice for private home photographs.

## Illustrative cost arithmetic — not a purchase

- RunPod L40S, 1 GPU hour + 50 GB standard network storage for one month: approximately $1.09 + $3.50 = $4.59, before other charges.
- RunPod L40S, 10 GPU minutes + 50 GB storage for one month: approximately $0.18 + $3.50 = $3.68, before other charges.
- Modal L40S, 1 GPU hour: approximately $1.95 compute; the published Starter plan lists $30 monthly compute credits and 1 TiB/month included volume allowance, subject to plan terms and actual usage.
- Comfy Custom Build RTX PRO 6000, 1 GPU hour + 50 GB network storage for one month: approximately $3.49 + $10.00 = $13.49, before plan/credit and other charges.

No option is being activated. The arithmetic is for comparing architecture only.

## Compatibility and privacy findings

### RunPod Secure Cloud
- The current adapter speaks stock ComfyUI routes such as `/upload/image`, `/prompt`, `/history/{prompt_id}`, `/view`, and read-only preflight routes.
- A private authenticated gateway/reverse proxy is still required: stock ComfyUI does not provide the Bearer-token authentication expected by the NEXORA transport by default.
- Keep the pod private; do not expose the ComfyUI port directly to the public internet.
- Confirm volume lifecycle, deletion, region, access controls, backup behavior, and data processing terms before any user photo is sent.

### Modal
- Modal publishes zero data retention for request/response payloads on Servers and Dedicated/Shared Endpoints; Function inputs/outputs may be retained up to seven days. Logs are retained according to plan. Persistent Volumes remain until explicitly deleted.
- This is potentially attractive for a private API, but requires an independently implemented Modal service wrapper, deployment controls, and a new transport adapter. It is not plug-compatible with the existing RunPod/self-hosted ComfyUI client.
- The Starter credit allowance is not authorization to deploy or incur charges.

### Comfy Cloud
- Custom Build pricing is GPU-time based plus persistent model storage; published RTX PRO 6000 rate is $3.49/hour and network storage $0.20/GB/month.
- The FireRed example uses the Comfy SDK/Cloud API path. It is separate from the local ComfyUI `/prompt` transport already implemented.
- Before use, verify FireRed workflow/node/model compatibility, plan limits, storage retention, region, access control, and image handling.

## Safety gates before any paid or photo-based test

1. Verify the exact FireRed 1.1 workflow and all model assets on a real runtime using preflight only.
2. Pin ComfyUI version, custom-node revisions, model filenames, workflow JSON and SHA-256 hash.
3. Put the runtime behind private networking and authenticated server-side gateway; no credentials in the browser.
4. Set a hard spending cap, concurrency limit, job timeout, and automatic shutdown policy.
5. Confirm region, data processing terms, retention, deletion, backup and log policies.
6. Use synthetic test images first. Only use the user's original room photo after runtime validation and explicit consent.
7. Preserve the original upload as immutable; store each generated result as a separate immutable object.
8. Run visual quality evaluation before accepting any result.

## Cancellation safety

Stock ComfyUI's `/interrupt` is a server-level stop, not a safe per-job stop for a shared worker. The NEXORA transport now deletes only the specified pending queue item. If the job is already running, the app must not claim GPU execution has stopped. True running-job cancellation requires a dedicated worker per job or a provider with verified per-job cancellation.

## Sources

- RunPod pricing: https://www.runpod.io/pricing
- Modal pricing: https://modal.com/pricing
- Modal security and retention: https://modal.com/docs/guide/security
- Comfy Cloud pricing: https://comfy.org/pricing/
- ComfyUI server routes: https://github.com/Comfy-Org/docs/blob/main/development/comfyui-server/comms_routes.mdx

No production integration is implied. V1, V2, Pages, Workers and Production remain untouched.
