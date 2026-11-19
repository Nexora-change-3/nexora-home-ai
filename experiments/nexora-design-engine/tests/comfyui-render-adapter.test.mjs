import test from "node:test";
import assert from "node:assert/strict";
import { createComfyUiRenderAdapter } from "../model-adapters/comfyui-render-adapter.mjs";

function setup(overrides = {}) {
  const calls = [];
  const transport = {
    async uploadImage(input) { calls.push(["upload", input]); return { name: "input.png" }; },
    async queuePrompt(input) { calls.push(["queue", input]); return { prompt_id: "prompt-123" }; },
    async getHistory() {
      calls.push(["history"]);
      return { "prompt-123": { status: { completed: true }, outputs: { "9": { images: [{ filename: "render.png", subfolder: "", type: "output" }] } } } };
    },
    async getOutput() { calls.push(["output"]); return new Uint8Array([9, 8, 7]); },
    async storeResult(input) { calls.push(["store", input]); return { image_ref: "nexora://results/immutable-1" }; },
    ...overrides.transport
  };
  const adapter = createComfyUiRenderAdapter({
    transport,
    workflow: { "1": { inputs: { image: "", text: "" } }, "9": { inputs: {} } },
    nodeInputs: { image: { node_id: "1", input_name: "image" }, prompt: { node_id: "1", input_name: "text" } },
    outputNodeId: "9",
    modelId: "FireRed-Image-Edit-1.1",
    modelRevision: "1.1",
    workflowHash: "sha256:fixture",
    pollIntervalMs: 0,
    sleep: async () => {},
    ...overrides.options
  });
  const request = {
    request_id: "req-1",
    source_image_ref: "nexora://source/original",
    source_image: { bytes: new Uint8Array([1, 2, 3]), mime_type: "image/png" },
    design_brief: { render_instructions: "Create a warm contemporary kitchen." },
    safety_policy: { preserve_source: true }
  };
  return { adapter, calls, request };
}

test("runs upload -> queue -> history -> output -> immutable storage", async () => {
  const { adapter, calls, request } = setup();
  const result = await adapter.render(request);
  assert.equal(result.status, "succeeded");
  assert.equal(result.image_ref, "nexora://results/immutable-1");
  assert.deepEqual(calls.map(([name]) => name), ["upload", "queue", "history", "output", "store"]);
  const queuedWorkflow = calls.find(([name]) => name === "queue")[1].workflow;
  assert.equal(queuedWorkflow["1"].inputs.image, "input.png");
  assert.equal(queuedWorkflow["1"].inputs.text, "Create a warm contemporary kitchen.");
  assert.equal(request.source_image.bytes[0], 1);
  assert.equal(calls.find(([name]) => name === "store")[1].metadata.source_image_ref, request.source_image_ref);
});

test("rejects unsupported MIME and missing source bytes before upload", async () => {
  const { adapter, calls, request } = setup();
  await assert.rejects(adapter.render({ ...request, source_image: { bytes: new Uint8Array([1]), mime_type: "image/gif" } }), { code: "UNSUPPORTED_IMAGE_TYPE" });
  await assert.rejects(adapter.render({ ...request, source_image: null }), { code: "SOURCE_IMAGE_UNAVAILABLE" });
  assert.equal(calls.length, 0);
});

test("fails closed when the configured output node has no image", async () => {
  const { adapter, request } = setup({ transport: { async getHistory() { return { "prompt-123": { status: { completed: true }, outputs: {} } }; } } });
  await assert.rejects(adapter.render(request), { code: "OUTPUT_NOT_FOUND" });
});

test("rejects a queue acknowledgement without prompt_id", async () => {
  const { adapter, request } = setup({ transport: { async queuePrompt() { return {}; } } });
  await assert.rejects(adapter.render(request), { code: "QUEUE_FAILED" });
});

test("does not accept an arbitrary workflow URL or workflow supplied by request", async () => {
  const { adapter, request } = setup();
  const result = await adapter.render({ ...request, workflow_url: "https://attacker.invalid/workflow.json" });
  assert.equal(result.status, "succeeded");
});

test("returns the same completed result for an idempotent request_id", async () => {
  const { adapter, calls, request } = setup();
  const first = await adapter.render(request);
  const second = await adapter.render(request);
  assert.deepEqual(second, first);
  assert.equal(calls.filter(([name]) => name === "queue").length, 1);
});

test("surfaces upstream execution errors without exposing raw upstream details", async () => {
  const errorHistory = {
    "prompt-123": {
      status: {
        status_str: "error",
        messages: [["execution_error", { exception_message: "private detail" }]]
      }
    }
  };
  const { adapter, request } = setup({ transport: { async getHistory() { return errorHistory; } } });
  await assert.rejects(adapter.render(request), (error) => error.code === "UPSTREAM_RENDER_FAILED" && !error.message.includes("private detail"));
});

test("honours cancellation before submitting a queued render", async () => {
  const controller = new AbortController();
  controller.abort();
  const { adapter, request, calls } = setup();
  await assert.rejects(adapter.render({ ...request, signal: controller.signal }), { code: "CANCELLED" });
  assert.equal(calls.length, 0);
});
