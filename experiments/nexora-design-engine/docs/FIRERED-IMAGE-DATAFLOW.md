# FireRed 1.1 image dataflow and acceptance checks

This document records the verified structure of the reviewed NEXORA API-format workflow and the automated boundary test. It does not claim that FireRed has run on a live GPU.

## Pinned workflow

- Reviewed graph SHA-256: `d9f3600d63a05457eb1b9126d37f16cf69ca3cb016b8dadc388feaf9b5bc5f2d`
- Exactly one external source: `LoadImage` node `143.image`
- The source enters `FluxKontextImageScale` node `167:147`
- Both prompt encoders `167:118` (positive) and `167:117` (negative) reference the same scaled source image
- `VAEEncode` node `167:125` also uses that same scaled source image
- `KSampler` node `167:130` consumes positive and negative conditioning plus the encoded latent
- `VAEDecode` node `167:126` decodes the sampler output
- `SaveImage` node `9` saves the decoded result

## Render path

1. The backend resolves the immutable source reference to image bytes.
2. The ComfyUI transport uploads those bytes once, with overwrite disabled.
3. The uploaded server filename is substituted into the single LoadImage input; the positive prompt is replaced with the design brief. The negative prompt remains as pinned in the reviewed graph.
4. The adapter submits the API graph once and polls its prompt history.
5. It resolves the image emitted by SaveImage node `9`, fetches the PNG, validates MIME and PNG signature, then asks NEXORA storage to create a new immutable image reference.
6. The result records request ID, source reference, model ID/revision, workflow hash, ComfyUI prompt ID and output reference.

The generic renderer rejects a storage response that reuses the original source reference.

## Automated coverage

`firered-dataflow.test.mjs` composes the FireRed adapter with the actual HTTP transport and a deterministic fake ComfyUI server. It checks live-preflight routes, one source upload, exact prompt and image links, negative-prompt retention, SaveImage output selection, PNG retrieval, provenance and source immutability.

This is a mocked integration test. It does not prove that a real ComfyUI installation has the required custom nodes/assets, that the workflow executes on GPU, or that the resulting interior design is aesthetically acceptable.

## Remaining live gates

- Provision a private authenticated ComfyUI runtime only after explicit approval of any costs and data-retention terms.
- Pass live `/object_info` and model-inventory preflight on that runtime.
- Run a synthetic fixture first and inspect actual generated output.
- Only after runtime, privacy and cost gates are approved, test with the user's original kitchen photograph.
