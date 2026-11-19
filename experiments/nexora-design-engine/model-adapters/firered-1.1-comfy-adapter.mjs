import { createComfyUiRenderAdapter } from "./comfyui-render-adapter.mjs";
import { validateFireRed11Workflow } from "./validate-firered-workflow.mjs";
import { preflightFireRed11Runtime } from "./firered-runtime-preflight.mjs";

export const FIRERED_11_MODEL_ID = "FireRedTeam/FireRed-Image-Edit-1.1";
export const FIRERED_11_WORKFLOW_SHA256 = "sha256:d9f3600d63a05457eb1b9126d37f16cf69ca3cb016b8dadc388feaf9b5bc5f2d";

/** Creates FireRed only after the exact reviewed graph and live runtime pass preflight. */
export async function createFireRed11ComfyAdapter({
  transport, workflow, workflowHash, modelRevision = "1.1", signal, ...options
} = {}) {
  if (workflowHash !== FIRERED_11_WORKFLOW_SHA256) {
    const error = new Error("The FireRed 1.1 workflow hash is not the reviewed NEXORA graph revision.");
    error.code = "FIRERED_WORKFLOW_REVISION_MISMATCH";
    throw error;
  }
  const validated = validateFireRed11Workflow(workflow);
  const runtimePreflight = await preflightFireRed11Runtime({ transport, workflow, signal });
  if (!runtimePreflight.compatible) {
    const error = new Error("The connected ComfyUI runtime is not compatible with the pinned FireRed 1.1 workflow.");
    error.code = "FIRERED_RUNTIME_INCOMPATIBLE";
    error.details = runtimePreflight;
    throw error;
  }
  const adapter = createComfyUiRenderAdapter({
    transport, workflow, workflowHash, modelId: FIRERED_11_MODEL_ID, modelRevision,
    nodeInputs: {
      image: validated.mappings.image,
      prompt: validated.mappings.prompt,
      seed: validated.mappings.seed
    },
    outputNodeId: validated.mappings.output_node_id,
    ...options
  });
  return Object.freeze({ ...adapter, runtimePreflight });
}
