import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createFireRed11ComfyAdapter, FIRERED_11_MODEL_ID, FIRERED_11_WORKFLOW_SHA256 } from "../model-adapters/firered-1.1-comfy-adapter.mjs";
import { createComfyUiHttpTransport } from "../model-adapters/comfyui-http-transport.mjs";

function stableStringify(value) {
  if (Array.isArray(value)) return \`[\${value.map(stableStringify).join(",")}]\`;
  if (value && typeof value === "object") return \`{\${Object.keys(value).sort().map((key) => \`\${JSON.stringify(key)}:\${stableStringify(value[key])}\`).join(",")}}\`;
  return JSON.stringify(value);
}

const workflow = JSON.parse(await readFile(new URL("../workflows/firered-image-edit-1.1-api.json", import.meta.url), "utf8"));
const workflowHash = \`sha256:\${createHash("sha256").update(stableStringify(workflow)).digest("hex")}\`;
const classes = [...new Set(Object.values(workflow).map((node) => node.class_type))];
const objectInfo = Object.fromEntries(classes.map((classType) => {
  const nodes = Object.values(workflow).filter((node) => node.class_type === classType);
  const names = [...new Set(nodes.flatMap((node) => Object.keys(node.inputs)))];
  return [classType, { input: { required: Object.fromEntries(names.map((name) => [name, ["ANY", {}]])) }, output: ["ANY"] }];
}));
const inventory = {
  diffusion_models: ["FireRed-Image-Edit-1.1-transformer.safetensors"],
  loras: ["FireRed-Image-Edit-1.0-Lightning-8steps-v1.0.safetensors"],
  text_encoders: ["qwen_2.5_vl_7b_fp8_scaled.safetensors"],
  vae: ["qwen_image_vae.safetensors"]
};
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

test("pins FireRed adapter to the reviewed workflow revision", async () => {
  assert.equal(workflowHash, FIRERED_11_WORKFLOW_SHA256);
  await assert.rejects(
    () => createFireRed11ComfyAdapter({ transport: {}, workflow, workflowHash: "sha256:" + "0".repeat(64) }),
    { code: "FIRERED_WORKFLOW_REVISION_MISMATCH" }
  );
});

test("runs the full FireRed dataflow through the real HTTP transport boundary with one immutable source upload", async () => {
  const calls = [];
  let stored;
  const originalBytes = new Uint8Array(png);
  const originalRequest = {
    request_id: "nexora-firered-e2e-001",
    source_image_ref: "nexora://source/original-kitchen",
    source_image: { bytes: originalBytes, mime_type: "image/png" },
    design_brief: { render_instructions: "Create a warm natural kitchen with a new composition, natural oak, tactile stone and layered lighting." },
    safety_policy: { preserve_source: true }
  };

  const fakeFetch = async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: init.method || "GET" });
    if (parsed.pathname === "/object_info") {
      return Response.json(objectInfo);
    }
    if (parsed.pathname.startsWith("/models/")) {
      return Response.json(inventory[parsed.pathname.split("/").pop()]);
    }
    if (parsed.pathname === "/system_stats") {
      return Response.json({ system: { comfyui_version: "test-runtime" } });
    }
    if (parsed.pathname === "/upload/image") {
      const form = init.body;
      const uploadedBlob = form.get("image");
      assert.equal(uploadedBlob.type, "image/png");
      assert.deepEqual([...new Uint8Array(await uploadedBlob.arrayBuffer())], [...png]);
      assert.equal(form.get("overwrite"), "false");
      return Response.json({ name: "nexora-original-upload.png", subfolder: "", type: "input" });
    }
    if (parsed.pathname === "/prompt") {
      const body = JSON.parse(init.body);
      const graph = body.prompt;
      assert.equal(body.client_id, originalRequest.request_id);
      assert.equal(graph["143"].inputs.image, "nexora-original-upload.png");
      assert.equal(graph["167:118"].inputs.prompt, originalRequest.design_brief.render_instructions);
      assert.equal(graph["167:117"].inputs.prompt, "", "the reviewed negative prompt remains unchanged");
      assert.deepEqual(graph["167:118"].inputs.image1, ["167:147", 0]);
      assert.deepEqual(graph["167:117"].inputs.image1, ["167:147", 0]);
      assert.deepEqual(graph["167:147"].inputs.image, ["143", 0]);
      assert.deepEqual(graph["167:125"].inputs.pixels, ["167:147", 0]);
      assert.deepEqual(graph["9"].inputs.images, ["167:126", 0]);
      assert.equal(graph["167:130"].inputs.seed, 43);
      return Response.json({ prompt_id: "firered-e2e-job-001" });
    }
    if (parsed.pathname === "/history/firered-e2e-job-001") {
      return Response.json({
        "firered-e2e-job-001": {
          status: { completed: true, status_str: "success" },
          outputs: { "9": { images: [{ filename: "firered-result.png", subfolder: "", type: "output" }] } }
        }
      });
    }
    if (parsed.pathname === "/view") {
      assert.equal(parsed.searchParams.get("filename"), "firered-result.png");
      assert.equal(parsed.searchParams.get("type"), "output");
      return new Response(png, { status: 200, headers: { "content-type": "image/png", "content-length": String(png.byteLength) } });
    }
    throw new Error("Unexpected ComfyUI route: " + parsed.pathname);
  };

  const transport = createComfyUiHttpTransport({
    baseUrl: "https://comfy.private.example",
    allowedOrigins: ["https://comfy.private.example"],
    authToken: "test-only-server-token",
    fetchImpl: fakeFetch,
    storeResult: async (input) => {
      stored = input;
      return { image_ref: "nexora://results/firered-e2e-001" };
    }
  });
  const adapter = await createFireRed11ComfyAdapter({
    transport, workflow, workflowHash, pollIntervalMs: 0, sleep: async () => {}
  });
  assert.equal(adapter.modelId, FIRERED_11_MODEL_ID);
  assert.equal(adapter.runtimePreflight.compatible, true);

  const result = await adapter.render(originalRequest);
  assert.equal(result.status, "succeeded");
  assert.equal(result.request_id, originalRequest.request_id);
  assert.equal(result.image_ref, "nexora://results/firered-e2e-001");
  assert.notEqual(result.image_ref, originalRequest.source_image_ref);
  assert.equal(result.model_id, FIRERED_11_MODEL_ID);
  assert.equal(result.workflow_hash, FIRERED_11_WORKFLOW_SHA256);
  assert.equal(result.prompt_id, "firered-e2e-job-001");
  assert.equal(stored.metadata.source_image_ref, originalRequest.source_image_ref);
  assert.equal(stored.metadata.workflow_hash, FIRERED_11_WORKFLOW_SHA256);
  assert.equal(stored.metadata.model_id, FIRERED_11_MODEL_ID);
  assert.equal(stored.mimeType, "image/png");
  assert.deepEqual([...stored.bytes], [...png]);
  assert.deepEqual([...originalRequest.source_image.bytes], [...png], "original photo bytes remain untouched");
  assert.equal(calls.filter((call) => call.path === "/upload/image").length, 1, "exactly one original image is uploaded");
  assert.equal(calls.filter((call) => call.path === "/prompt").length, 1, "the render is queued exactly once");
  assert.equal(workflow["143"].inputs.image, "nexora-source-placeholder.png", "the pinned graph template is not mutated");
  assert.ok(calls.every((call) => call.method));
});
