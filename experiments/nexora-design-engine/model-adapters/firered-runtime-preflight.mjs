const MODEL_FOLDERS = Object.freeze({
  transformer: "diffusion_models",
  lightning_lora: "loras",
  text_encoder: "text_encoders",
  vae: "vae"
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}
function modelNames(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => typeof item === "string");
  if (payload && Array.isArray(payload.models)) return payload.models.filter((item) => typeof item === "string");
  return [];
}

/** Compare the pinned workflow with live ComfyUI /object_info and /models data. */
export function inspectFireRed11Runtime({ workflow, objectInfo, modelInventory = {} } = {}) {
  assert(workflow && objectInfo && typeof objectInfo === "object", "INVALID_RUNTIME_INFO", "A workflow and live ComfyUI object_info response are required.");
  const missingNodes = [];
  const missingRequiredInputs = [];
  const unknownInputs = [];
  const experimentalNodes = [];
  for (const [nodeId, workflowNode] of Object.entries(workflow)) {
    const definition = objectInfo[workflowNode.class_type];
    if (!definition || typeof definition !== "object") {
      missingNodes.push({ node_id: nodeId, class_type: workflowNode.class_type });
      continue;
    }
    if (definition.experimental === true) experimentalNodes.push({ node_id: nodeId, class_type: workflowNode.class_type });
    const required = definition.input?.required;
    const optional = definition.input?.optional;
    const requiredNames = required && typeof required === "object" && !Array.isArray(required)
      ? Object.keys(required)
      : [];
    const optionalNames = optional && typeof optional === "object" && !Array.isArray(optional)
      ? Object.keys(optional)
      : [];
    const allowedNames = new Set([...requiredNames, ...optionalNames]);

    for (const inputName of requiredNames) {
      if (!Object.prototype.hasOwnProperty.call(workflowNode.inputs || {}, inputName)) {
        missingRequiredInputs.push({ node_id: nodeId, class_type: workflowNode.class_type, input: inputName });
      }
    }
    for (const inputName of Object.keys(workflowNode.inputs || {})) {
      if (!allowedNames.has(inputName)) {
        unknownInputs.push({ node_id: nodeId, class_type: workflowNode.class_type, input: inputName });
      }
    }
  }

  const assets = [
    { key: "transformer", folder: MODEL_FOLDERS.transformer, name: workflow["167:128"]?.inputs?.unet_name },
    { key: "lightning_lora", folder: MODEL_FOLDERS.lightning_lora, name: workflow["167:151"]?.inputs?.lora_name },
    { key: "text_encoder", folder: MODEL_FOLDERS.text_encoder, name: workflow["167:115"]?.inputs?.clip_name },
    { key: "vae", folder: MODEL_FOLDERS.vae, name: workflow["167:116"]?.inputs?.vae_name }
  ];
  const missingAssets = [];
  const unverifiedAssetFolders = [];
  for (const asset of assets) {
    if (!Object.prototype.hasOwnProperty.call(modelInventory, asset.folder)) {
      unverifiedAssetFolders.push(asset.folder);
      continue;
    }
    if (!modelNames(modelInventory[asset.folder]).includes(asset.name)) missingAssets.push(asset);
  }
  const compatible = missingNodes.length === 0 && missingRequiredInputs.length === 0 && unknownInputs.length === 0 && missingAssets.length === 0 && unverifiedAssetFolders.length === 0;
  return Object.freeze({
    compatible,
    status: compatible ? (experimentalNodes.length ? "compatible_with_experimental_nodes" : "compatible") : "incompatible_or_incomplete",
    node_count: Object.keys(workflow).length,
    missing_nodes: Object.freeze(missingNodes),
    missing_required_inputs: Object.freeze(missingRequiredInputs),
    unknown_inputs: Object.freeze(unknownInputs),
    experimental_nodes: Object.freeze(experimentalNodes),
    missing_model_assets: Object.freeze(missingAssets),
    unverified_model_folders: Object.freeze([...new Set(unverifiedAssetFolders)]),
    model_asset_folders: MODEL_FOLDERS
  });
}

export async function preflightFireRed11Runtime({ transport, workflow, signal } = {}) {
  assert(transport && typeof transport.getObjectInfo === "function" && typeof transport.getModels === "function", "INVALID_RUNTIME_TRANSPORT", "The ComfyUI transport must expose read-only object_info and model inventory methods.");
  const objectInfo = await transport.getObjectInfo({ signal });
  const folders = Object.values(MODEL_FOLDERS);
  const modelInventory = {};
  for (const folder of folders) modelInventory[folder] = await transport.getModels(folder, { signal });
  let system = null;
  if (typeof transport.getSystemStats === "function") system = await transport.getSystemStats({ signal });
  const report = inspectFireRed11Runtime({ workflow, objectInfo, modelInventory });
  return Object.freeze({ ...report, runtime: system?.system ? {
    comfyui_version: system.system.comfyui_version || null,
    python_version: system.system.python_version || null,
    pytorch_version: system.system.pytorch_version || null
  } : null });
}
