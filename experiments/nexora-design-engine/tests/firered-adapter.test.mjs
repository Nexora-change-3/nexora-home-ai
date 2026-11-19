import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createFireRed11ComfyAdapter, FIRERED_11_MODEL_ID } from "../model-adapters/firered-1.1-comfy-adapter.mjs";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const workflow = JSON.parse(await readFile(new URL("../workflows/firered-image-edit-1.1-api.json", import.meta.url), "utf8"));
const workflowHash = `sha256:${createHash("sha256").update(stableStringify(workflow)).digest("hex")}`;

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
function runtimeMethods(calls, { missingNode = false } = {}) {
  const info = structuredClone(objectInfo);
  if (missingNode) delete info.KSampler;
  return {
    async getObjectInfo() { calls.push("object_info"); return info; },
    async getModels(folder) { calls.push(`models:${folder}`); return modelInventory[folder]; },
    async getSystemStats() { calls.push("system_stats"); return { system: { comfyui_version: "test" } }; }
  };
}

test("binds the inspected single-image FireRed graph to the renderer", async () => {
  const calls = [];
  const transport = {
    ...runtimeMethods(calls),
    async uploadImage(input) { calls.push(["upload", input]); return { name: "uploaded-original.png" }; },
    async queuePrompt(input) { calls.push(["queue", input]); return { prompt_id: "firered-job-1" }; },
    async getHistory() { return { "firered-job-1": { status: { completed: true }, outputs: { "9": { images: [{ filename: "result.png", subfolder: "", type: "output" }] } } } }; },
    async getOutput() { return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); },
    async storeResult(input) { calls.push(["store", input]); return { image_ref: "nexora://results/firered-1" }; }
  };
  const adapter = await createFireRed11ComfyAdapter({ transport, workflow, workflowHash, pollIntervalMs: 0, sleep: async () => {} });
  assert.equal(adapter.modelId, FIRERED_11_MODEL_ID);
  const request = {
    request_id: "firered-req-1", source_image_ref: "nexora://source/original",
    source_image: { bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), mime_type: "image/png" },
    design_brief: { render_instructions: "Create a warm natural kitchen with a new layout and material palette." },
    safety_policy: { preserve_source: true }
  };
  const result = await adapter.render(request);
  assert.equal(result.status, "succeeded");
  assert.equal(result.image_ref, "nexora://results/firered-1");
  const queued = calls.find(([name]) => name === "queue")[1].workflow;
  assert.equal(queued["143"].inputs.image, "uploaded-original.png");
  assert.equal(queued["167:118"].inputs.prompt, request.design_brief.render_instructions);
  assert.equal(queued["167:130"].inputs.seed, 43, "the template seed is retained when no override is supplied");
  assert.equal(request.source_image.bytes[0], 137, "the original source bytes are not mutated");
});

test("refuses to construct a FireRed adapter from an invalid graph", async () => {
  await assert.rejects(() => createFireRed11ComfyAdapter({ transport: {}, workflow: { nodes: [], links: [] }, workflowHash }), { code: "INVALID_FIRERED_WORKFLOW" });
});


test("blocks adapter creation before image upload when live runtime lacks a required node", async () => {
  const calls = [];
  const transport = { ...runtimeMethods(calls, { missingNode: true }),
    async uploadImage() { calls.push("upload"); throw new Error("must not upload"); },
    async queuePrompt() { calls.push("queue"); throw new Error("must not queue"); },
    async getHistory() {}, async getOutput() {}, async storeResult() {}
  };
  await assert.rejects(
    () => createFireRed11ComfyAdapter({ transport, workflow, workflowHash }),
    (error) => error.code === "FIRERED_RUNTIME_INCOMPATIBLE" && error.details.missing_nodes.some((node) => node.class_type === "KSampler")
  );
  assert.equal(calls.includes("upload"), false);
  assert.equal(calls.includes("queue"), false);
});

test("blocks adapter creation before upload when live graph validation fails", async () => {
  const calls = [];
  const transport = {
    ...runtimeMethods(calls),
    async uploadImage() { calls.push("upload"); throw new Error("must not upload"); },
    async queuePrompt() { calls.push("queue"); throw new Error("must not queue"); },
    async getHistory() {}, async getOutput() {}, async storeResult() {}
  };
  const changedWorkflow = structuredClone(workflow);
  changedWorkflow["167:147"].inputs.image = ["missing-source", 0];
  await assert.rejects(
    () => createFireRed11ComfyAdapter({ transport, workflow: changedWorkflow, workflowHash }),
    (error) => error.code === "FIRERED_RUNTIME_INCOMPATIBLE" &&
      error.details.graph_validation.error_code === "BROKEN_COMFY_LINK"
  );
  assert.equal(calls.includes("upload"), false);
  assert.equal(calls.includes("queue"), false);
});
