import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { validateFireRed11Workflow } from "../model-adapters/validate-firered-workflow.mjs";

const workflow = JSON.parse(await readFile(new URL("../workflows/firered-image-edit-1.1-api.json", import.meta.url), "utf8"));

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

test("matches the documented SHA-256 pin for the canonical workflow template", () => {
  const hash = createHash("sha256").update(stableStringify(workflow)).digest("hex");
  assert.equal(hash, "d9f3600d63a05457eb1b9126d37f16cf69ca3cb016b8dadc388feaf9b5bc5f2d");
});

test("accepts the pinned API-format FireRed 1.1 graph and reports NEXORA mappings", () => {
  const result = validateFireRed11Workflow(workflow);
  assert.equal(result.format, "comfyui-api-prompt");
  assert.equal(result.node_count, 22);
  assert.equal(result.source_image_count, 1);
  assert.deepEqual(result.mappings.image, { node_id: "143", input_name: "image" });
  assert.deepEqual(result.mappings.prompt, { node_id: "167:118", input_name: "prompt" });
  assert.deepEqual(result.mappings.seed, { node_id: "167:130", input_name: "seed" });
  assert.equal(result.mappings.output_node_id, "9");
  assert.equal(result.local_runtime_compatibility, "not_verified");
});
test("rejects frontend-format graphs", () => {
  assert.throws(() => validateFireRed11Workflow({ nodes: [], links: [] }), { code: "INVALID_FIRERED_WORKFLOW" });
});
test("rejects an extra external LoadImage input", () => {
  const changed = structuredClone(workflow);
  changed["extra-image"] = { class_type: "LoadImage", inputs: { image: "other.png" } };
  assert.throws(() => validateFireRed11Workflow(changed), { code: "AMBIGUOUS_SOURCE_IMAGE" });
});
test("rejects broken graph links", () => {
  const changed = structuredClone(workflow);
  changed["167:117"].inputs.image1 = ["missing-node", 0];
  assert.throws(() => validateFireRed11Workflow(changed), { code: "BROKEN_FIRERED_LINK" });
});
test("rejects a source image path that no longer starts at LoadImage", () => {
  const changed = structuredClone(workflow);
  changed["167:147"].inputs.image = ["167:128", 0];
  assert.throws(() => validateFireRed11Workflow(changed), { code: "INVALID_SOURCE_MAPPING" });
});
test("rejects an output node that bypasses VAE Decode", () => {
  const changed = structuredClone(workflow);
  changed["9"].inputs.images = ["167:130", 0];
  assert.throws(() => validateFireRed11Workflow(changed), { code: "INVALID_OUTPUT_MAPPING" });
});
test("rejects a mismatched FireRed model asset", () => {
  const changed = structuredClone(workflow);
  changed["167:128"].inputs.unet_name = "FireRed-Image-Edit-1.0-transformer.safetensors";
  assert.throws(() => validateFireRed11Workflow(changed), { code: "WRONG_MODEL_ASSET" });
});
