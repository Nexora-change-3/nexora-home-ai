import { createComfyUiRenderAdapter } from "./comfyui-render-adapter.mjs";
import { validateFireRed11Workflow } from "./validate-firered-workflow.mjs";
import { preflightFireRed11Runtime } from "./firered-runtime-preflight.mjs";

export const FIRERED_11_MODEL_ID = "FireRedTeam/FireRed-Image-Edit-1.1";

/** Creates FireRed only after live ComfyUI nodes and model assets pass preflight. */
export async function createFireRed11ComfyAdapter({
  transport, workflow, workflowHash, modelRevision = "1.1", signal, ...options
} = {}) {
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
