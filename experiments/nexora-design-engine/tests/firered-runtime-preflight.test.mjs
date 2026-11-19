import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inspectFireRed11Runtime, preflightFireRed11Runtime } from "../model-adapters/firered-runtime-preflight.mjs";

const workflow = JSON.parse(await readFile(new URL("../workflows/firered-image-edit-1.1-api.json", import.meta.url), "utf8"));
const classes = [...new Set(Object.values(workflow).map((node) => node.class_type))];
const objectInfo = Object.fromEntries(classes.map((classType) => [classType, {
  input: { required: Object.fromEntries(Object.entries(workflow).filter(([, node]) => node.class_type === classType).flatMap(([, node]) => Object.keys(node.inputs).map((name) => [name, ["STRING", {}]]))) },
  experimental: classType === "ComfySwitchNode"
}]));
const modelInventory = {
  diffusion_models: ["FireRed-Image-Edit-1.1-transformer.safetensors"],
  loras: ["FireRed-Image-Edit-1.0-Lightning-8steps-v1.0.safetensors"],
  text_encoders: ["qwen_2.5_vl_7b_fp8_scaled.safetensors"],
  vae: ["qwen_image_vae.safetensors"]
};

test("accepts a complete runtime inventory and reports experimental nodes", () => {
  const result = inspectFireRed11Runtime({ workflow, objectInfo, modelInventory });
  assert.equal(result.compatible, true);
  assert.equal(result.status, "compatible_with_experimental_nodes");
  assert.ok(result.experimental_nodes.some((node) => node.class_type === "ComfySwitchNode"));
  assert.equal(result.missing_nodes.length, 0);
  assert.equal(result.missing_model_assets.length, 0);
});

test("reports missing node classes", () => {
  const changed = { ...objectInfo };
  delete changed.KSampler;
  const result = inspectFireRed11Runtime({ workflow, objectInfo: changed, modelInventory });
  assert.equal(result.compatible, false);
  assert.ok(result.missing_nodes.some((node) => node.class_type === "KSampler"));
});

test("reports missing required inputs instead of submitting an invalid workflow", () => {
  const changed = structuredClone(objectInfo);
  changed.KSampler.input.required.extra_required_input = ["STRING", {}];
  const result = inspectFireRed11Runtime({ workflow, objectInfo: changed, modelInventory });
  assert.equal(result.compatible, false);
  assert.ok(result.missing_required_inputs.some((item) => item.class_type === "KSampler" && item.input === "extra_required_input"));
});

test("rejects workflow inputs not declared by the live ComfyUI node schema", () => {
  const changedWorkflow = structuredClone(workflow);
  changedWorkflow["167:130"].inputs.nexora_unknown_input = "unexpected";
  const result = inspectFireRed11Runtime({
    workflow: changedWorkflow,
    objectInfo,
    modelInventory
  });
  assert.equal(result.compatible, false);
  assert.ok(result.unknown_inputs.some((item) =>
    item.node_id === "167:130" && item.input === "nexora_unknown_input"
  ));
});

test("reports absent model files and unqueried model folders separately", () => {
  const changed = { ...modelInventory, loras: [] };
  delete changed.vae;
  const result = inspectFireRed11Runtime({ workflow, objectInfo, modelInventory: changed });
  assert.ok(result.missing_model_assets.some((asset) => asset.key === "lightning_lora"));
  assert.ok(result.unverified_model_folders.includes("vae"));
});

test("preflight queries node info, model inventory and runtime version without queueing a render", async () => {
  const calls = [];
  const transport = {
    async getObjectInfo() { calls.push("object_info"); return objectInfo; },
    async getModels(folder) { calls.push(folder); return modelInventory[folder]; },
    async getSystemStats() { calls.push("system_stats"); return { system: { comfyui_version: "0.3.test", python_version: "3.12", pytorch_version: "2.x" } }; }
  };
  const result = await preflightFireRed11Runtime({ transport, workflow });
  assert.equal(result.compatible, true);
  assert.equal(result.runtime.comfyui_version, "0.3.test");
  assert.equal(calls.includes("object_info"), true);
  assert.equal(calls.includes("system_stats"), true);
  assert.equal(calls.includes("prompt"), false);
});
