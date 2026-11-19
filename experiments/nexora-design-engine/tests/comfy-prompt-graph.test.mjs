import test from "node:test";
import assert from "node:assert/strict";
import { validateComfyPromptGraph } from "../model-adapters/validate-comfy-prompt-graph.mjs";

const prompt = {
  "1": { class_type: "LoadImage", inputs: { image: "source.png" } },
  "2": { class_type: "ImageScale", inputs: { image: ["1", 0] } },
  "3": { class_type: "SaveImage", inputs: { images: ["2", 0] } }
};
const info = {
  LoadImage: { input: { required: { image: ["STRING", {}] }, optional: {} }, output: ["IMAGE"] },
  ImageScale: { input: { required: { image: ["IMAGE", {}] }, optional: {} }, output: ["IMAGE"] },
  SaveImage: { input: { required: { images: ["IMAGE", {}] }, optional: {} }, output: [] }
};

test("accepts a valid API prompt graph and checks live schemas", () => {
  const result = validateComfyPromptGraph(prompt, info);
  assert.equal(result.valid, true);
  assert.equal(result.node_count, 3);
  assert.equal(result.link_count, 2);
  assert.equal(result.live_schema_checked, true);
});

test("rejects dangling node references", () => {
  const changed = structuredClone(prompt);
  changed["2"].inputs.image = ["missing", 0];
  assert.throws(() => validateComfyPromptGraph(changed), { code: "BROKEN_COMFY_LINK" });
});

test("rejects negative and non-integer output slots", () => {
  const changed = structuredClone(prompt);
  changed["2"].inputs.image = ["1", -1];
  assert.throws(() => validateComfyPromptGraph(changed), { code: "INVALID_COMFY_LINK" });
});

test("rejects output slots outside the live node schema", () => {
  const changed = structuredClone(prompt);
  changed["2"].inputs.image = ["1", 1];
  assert.throws(() => validateComfyPromptGraph(changed, info), { code: "COMFY_OUTPUT_INDEX_OUT_OF_RANGE" });
});

test("rejects input names absent from the live node schema", () => {
  const changed = structuredClone(prompt);
  changed["2"].inputs.unknown = ["1", 0];
  assert.throws(() => validateComfyPromptGraph(changed, info), { code: "UNKNOWN_COMFY_INPUT" });
});

test("rejects incompatible live connection types", () => {
  const changed = structuredClone(prompt);
  const wrongInfo = structuredClone(info);
  wrongInfo.LoadImage.output = ["MASK"];
  assert.throws(() => validateComfyPromptGraph(changed, wrongInfo), { code: "COMFY_LINK_TYPE_MISMATCH" });
});

test("reports unavailable node schemas without pretending they were validated", () => {
  const result = validateComfyPromptGraph(prompt, { LoadImage: info.LoadImage });
  assert.equal(result.valid, true);
  assert.equal(result.live_schema_checked, true);
  assert.equal(result.schema_warnings.length, 2);
});
