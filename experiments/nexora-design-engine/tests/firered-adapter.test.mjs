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

test("binds the inspected single-image FireRed graph to the renderer", async () => {
  const calls = [];
  const transport = {
    async uploadImage(input) { calls.push(["upload", input]); return { name: "uploaded-original.png" }; },
    async queuePrompt(input) { calls.push(["queue", input]); return { prompt_id: "firered-job-1" }; },
    async getHistory() { return { "firered-job-1": { status: { completed: true }, outputs: { "9": { images: [{ filename: "result.png", subfolder: "", type: "output" }] } } } }; },
    async getOutput() { return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); },
    async storeResult(input) { calls.push(["store", input]); return { image_ref: "nexora://results/firered-1" }; }
  };
  const adapter = createFireRed11ComfyAdapter({ transport, workflow, workflowHash, pollIntervalMs: 0, sleep: async () => {} });
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

test("refuses to construct a FireRed adapter from an invalid graph", () => {
  assert.throws(() => createFireRed11ComfyAdapter({ transport: {}, workflow: { nodes: [], links: [] }, workflowHash }), { code: "INVALID_FIRERED_WORKFLOW" });
});
