const REQUIRED_NODES = Object.freeze({
  source: "143", positivePrompt: "167:118", negativePrompt: "167:117",
  seed: "167:130", output: "9", imageScale: "167:147",
  vaeEncode: "167:125", vaeDecode: "167:126"
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}
function node(workflow, id, classType) {
  const found = workflow[id];
  assert(found && found.class_type === classType && found.inputs && typeof found.inputs === "object",
    "INVALID_FIRERED_WORKFLOW", `Expected ${classType} at node ${id}.`);
  return found;
}
function isLink(value, nodeId) {
  return Array.isArray(value) && value.length === 2 && value[0] === nodeId && value[1] === 0;
}

/** Validates the Comfy Cloud API-format FireRed 1.1 graph adapted for NEXORA.
 * This checks graph structure only; it does not prove local ComfyUI compatibility.
 */
export function validateFireRed11Workflow(workflow) {
  assert(workflow && typeof workflow === "object" && !Array.isArray(workflow),
    "INVALID_FIRERED_WORKFLOW", "An API-format ComfyUI prompt object is required.");
  assert(!Array.isArray(workflow.nodes) && Object.keys(workflow).length > 0,
    "INVALID_FIRERED_WORKFLOW", "A frontend-format workflow is not accepted; use the API prompt graph.");

  for (const [id, item] of Object.entries(workflow)) {
    assert(item && typeof item === "object" && typeof item.class_type === "string" &&
      item.inputs && typeof item.inputs === "object" && !Array.isArray(item.inputs),
    "INVALID_FIRERED_WORKFLOW", `Node ${id} is not a valid API prompt node.`);
    for (const [inputName, value] of Object.entries(item.inputs)) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && Number.isInteger(value[1])) {
        assert(workflow[value[0]], "BROKEN_FIRERED_LINK", `Node ${id}.${inputName} references missing node ${value[0]}.`);
      }
    }
  }

  const sourceNodes = Object.entries(workflow).filter(([, item]) => item.class_type === "LoadImage");
  assert(sourceNodes.length === 1 && sourceNodes[0][0] === REQUIRED_NODES.source,
    "AMBIGUOUS_SOURCE_IMAGE", "The NEXORA FireRed template must contain exactly one external LoadImage node (143).");
  const source = node(workflow, REQUIRED_NODES.source, "LoadImage");
  assert(typeof source.inputs.image === "string" && source.inputs.image.length > 0,
    "INVALID_SOURCE_MAPPING", "LoadImage node 143 must expose an image filename input.");

  const scale = node(workflow, REQUIRED_NODES.imageScale, "FluxKontextImageScale");
  assert(isLink(scale.inputs.image, REQUIRED_NODES.source),
    "INVALID_SOURCE_MAPPING", "The image scale node must consume the single external source image.");
  const positive = node(workflow, REQUIRED_NODES.positivePrompt, "TextEncodeQwenImageEditPlus");
  const negative = node(workflow, REQUIRED_NODES.negativePrompt, "TextEncodeQwenImageEditPlus");
  assert(isLink(positive.inputs.image1, REQUIRED_NODES.imageScale) &&
    isLink(negative.inputs.image1, REQUIRED_NODES.imageScale),
    "INVALID_IMAGE_CONDITIONING", "Positive and negative encoders must use the same source image path.");
  assert(typeof positive.inputs.prompt === "string",
    "INVALID_PROMPT_MAPPING", "Positive prompt node 167:118 must expose a text prompt.");

  const sampler = node(workflow, REQUIRED_NODES.seed, "KSampler");
  assert(Number.isInteger(sampler.inputs.seed) && sampler.inputs.seed >= 0,
    "INVALID_SEED_MAPPING", "KSampler node 167:130 must expose an integer seed.");
  assert(isLink(sampler.inputs.positive, REQUIRED_NODES.positivePrompt) &&
    isLink(sampler.inputs.negative, REQUIRED_NODES.negativePrompt),
    "INVALID_PROMPT_MAPPING", "KSampler must consume the positive and negative prompt encoders.");

  const encode = node(workflow, REQUIRED_NODES.vaeEncode, "VAEEncode");
  assert(isLink(encode.inputs.pixels, REQUIRED_NODES.imageScale),
    "INVALID_SOURCE_MAPPING", "VAEEncode must derive its latent from the original source image.");
  const decode = node(workflow, REQUIRED_NODES.vaeDecode, "VAEDecode");
  assert(isLink(decode.inputs.samples, REQUIRED_NODES.seed),
    "INVALID_OUTPUT_MAPPING", "VAE Decode must consume the KSampler output.");
  const output = node(workflow, REQUIRED_NODES.output, "SaveImage");
  assert(isLink(output.inputs.images, REQUIRED_NODES.vaeDecode),
    "INVALID_OUTPUT_MAPPING", "SaveImage node 9 must save the VAE Decode result.");

  const unet = node(workflow, "167:128", "UNETLoader");
  const clip = node(workflow, "167:115", "CLIPLoader");
  const vae = node(workflow, "167:116", "VAELoader");
  const lora = node(workflow, "167:151", "LoraLoaderModelOnly");
  assert(unet.inputs.unet_name === "FireRed-Image-Edit-1.1-transformer.safetensors",
    "WRONG_MODEL_ASSET", "The workflow is not pinned to the FireRed Image Edit 1.1 transformer.");
  assert(clip.inputs.clip_name === "qwen_2.5_vl_7b_fp8_scaled.safetensors" &&
    vae.inputs.vae_name === "qwen_image_vae.safetensors",
    "WRONG_MODEL_ASSET", "The Qwen encoder or VAE asset does not match the inspected workflow.");
  assert(lora.inputs.lora_name === "FireRed-Image-Edit-1.0-Lightning-8steps-v1.0.safetensors",
    "WRONG_MODEL_ASSET", "The Lightning LoRA asset differs from the inspected workflow.");
  node(workflow, "167:154", "ComfySwitchNode");
  node(workflow, "167:157", "ComfySwitchNode");
  node(workflow, "167:164", "ComfySwitchNode");

  return Object.freeze({
    format: "comfyui-api-prompt", node_count: Object.keys(workflow).length, source_image_count: 1,
    mappings: Object.freeze({
      image: Object.freeze({ node_id: "143", input_name: "image" }),
      prompt: Object.freeze({ node_id: "167:118", input_name: "prompt" }),
      seed: Object.freeze({ node_id: "167:130", input_name: "seed" }),
      output_node_id: "9"
    }),
    model_assets: Object.freeze({
      transformer: unet.inputs.unet_name, text_encoder: clip.inputs.clip_name,
      vae: vae.inputs.vae_name, lightning_lora: lora.inputs.lora_name
    }),
    local_runtime_compatibility: "not_verified"
  });
}
