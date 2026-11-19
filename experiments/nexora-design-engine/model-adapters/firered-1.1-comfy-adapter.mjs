import { createComfyUiRenderAdapter } from "./comfyui-render-adapter.mjs";
import { validateFireRed11Workflow } from "./validate-firered-workflow.mjs";

export const FIRERED_11_MODEL_ID = "FireRedTeam/FireRed-Image-Edit-1.1";

/** Creates the FireRed 1.1 adapter only after validating the pinned API graph. */
export function createFireRed11ComfyAdapter({
  transport, workflow, workflowHash, modelRevision = "1.1", ...options
} = {}) {
  const validated = validateFireRed11Workflow(workflow);
  return createComfyUiRenderAdapter({
    transport, workflow, workflowHash, modelId: FIRERED_11_MODEL_ID, modelRevision,
    nodeInputs: {
      image: validated.mappings.image,
      prompt: validated.mappings.prompt,
      seed: validated.mappings.seed
    },
    outputNodeId: validated.mappings.output_node_id,
    ...options
  });
}
