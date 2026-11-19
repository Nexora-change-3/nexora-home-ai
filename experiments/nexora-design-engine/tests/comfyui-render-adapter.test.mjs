import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createComfyUiRenderAdapter } from "../model-adapters/comfyui-render-adapter.mjs";
import { createMemoryDispatchStore } from "../model-adapters/dispatch-ledger.mjs";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function setup(overrides = {}) {
  const calls = [];
  const workflow = { "1": { inputs: { image: "", text: "" } }, "9": { inputs: {} } };
  const workflowHash = `sha256:${createHash("sha256").update(stableStringify(workflow)).digest("hex")}`;
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
    transport, workflow,
    nodeInputs: { image: { node_id: "1", input_name: "image" }, prompt: { node_id: "1", input_name: "text" } },
    outputNodeId: "9", modelId: "FireRed-Image-Edit-1.1", modelRevision: "1.1",
    workflowHash, pollIntervalMs: 0, sleep: async () => {}, ...overrides.options
  });
  const request = {
    request_id: "req-1", source_image_ref: "nexora://source/original",
    source_image: { bytes: new Uint8Array([1, 2, 3]), mime_type: "image/png" },
    design_brief: { render_instructions: "Create a warm contemporary kitchen." },
    safety_policy: { preserve_source: true }
  };
  return { adapter, calls, request, workflow };
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
  await assert.rejects(adapter.render(request), { code: "QUEUE_OUTCOME_UNKNOWN" });
});

test("ignores caller-supplied workflow URLs and uses only the pinned workflow", async () => {
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
  const errorHistory = { "prompt-123": { status: { status_str: "error", messages: [["execution_error", { exception_message: "private detail" }]] } } };
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

test("enforces a timeout while an individual transport operation is hanging", async () => {
  let receivedSignal;
  const { adapter, request } = setup({ transport: { uploadImage({ signal }) { receivedSignal = signal; return new Promise(() => {}); } }, options: { timeoutMs: 15 } });
  await assert.rejects(adapter.render(request), { code: "RENDER_TIMEOUT" });
  assert.equal(receivedSignal.aborted, true);
});

test("propagates cancellation to an in-flight transport operation", async () => {
  const controller = new AbortController();
  let receivedSignal;
  const { adapter, request } = setup({ transport: { uploadImage({ signal }) { receivedSignal = signal; return new Promise(() => {}); } }, options: { timeoutMs: 1000 } });
  const pending = adapter.render({ ...request, signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort();
  await assert.rejects(pending, { code: "CANCELLED" });
  assert.equal(receivedSignal.aborted, true);
});

test("rejects a workflow when its configured SHA-256 pin is incorrect", async () => {
  const { adapter, request, calls } = setup({ options: { workflowHash: `sha256:${"0".repeat(64)}` } });
  await assert.rejects(adapter.render(request), { code: "WORKFLOW_HASH_MISMATCH" });
  assert.equal(calls.length, 0);
});

test("snapshots the workflow at construction and ignores later caller mutation", async () => {
  const { adapter, request, workflow, calls } = setup();
  workflow["1"].inputs.image = "tampered.png";
  const result = await adapter.render(request);
  assert.equal(result.status, "succeeded");
  const queuedWorkflow = calls.find(([name]) => name === "queue")[1].workflow;
  assert.equal(queuedWorkflow["1"].inputs.image, "input.png");
});


test("requests upstream cancellation for the acknowledged prompt when caller aborts", async () => {
  const controller = new AbortController();
  let markHistoryStarted;
  const historyStarted = new Promise((resolve) => { markHistoryStarted = resolve; });
  const cancelled = [];
  const { adapter, request } = setup({ transport: {
    async getHistory() { markHistoryStarted(); return new Promise(() => {}); },
    async cancelPrompt(promptId) { cancelled.push(promptId); return { requested: true, prompt_id: promptId }; }
  }});
  const pending = adapter.render({ ...request, signal: controller.signal });
  await historyStarted;
  controller.abort();
  await assert.rejects(pending, { code: "CANCELLED" });
  assert.deepEqual(cancelled, ["prompt-123"]);
});


test("refuses to overwrite the original source image reference", async () => {
  const { adapter, request } = setup({
    transport: {
      async storeResult() { return { image_ref: request.source_image_ref }; }
    }
  });
  await assert.rejects(adapter.render(request), { code: "SOURCE_OVERWRITE_BLOCKED" });
});


test("recreated adapters consult the shared dispatch ledger and never requeue an ambiguous submission", async () => {
  const dispatchStore = createMemoryDispatchStore();
  const first = setup({ options: { dispatchStore }, transport: { async queuePrompt() { throw new TypeError("connection lost after server accepted"); } } });
  await assert.rejects(first.adapter.render(first.request), { code: "QUEUE_OUTCOME_UNKNOWN" });
  const second = setup({ options: { dispatchStore } });
  await assert.rejects(second.adapter.render(second.request), { code: "DUPLICATE_SUBMISSION_BLOCKED" });
  assert.equal(second.calls.length, 0);
});

test("rejects reuse of a request_id for a different source image", async () => {
  const dispatchStore = createMemoryDispatchStore();
  const first = setup({ options: { dispatchStore } });
  await first.adapter.render(first.request);
  const second = setup({ options: { dispatchStore } });
  await assert.rejects(second.adapter.render({ ...second.request, source_image_ref: "nexora://source/other" }), { code: "REQUEST_ID_CONFLICT" });
  assert.equal(second.calls.length, 0);
});


test("recovers an already queued prompt without uploading or queueing a second render", async () => {
  const dispatchStore = createMemoryDispatchStore();
  await dispatchStore.claim({ requestId: "req-1", sourceImageRef: "nexora://source/original", workflowHash: `sha256:${createHash("sha256").update(stableStringify({ "1": { inputs: { image: "", text: "" } }, "9": { inputs: {} } })).digest("hex")}` });
  await dispatchStore.markQueued("req-1", "prompt-123");
  const { adapter, calls } = setup({ options: { dispatchStore } });
  const result = await adapter.recover("req-1");
  assert.equal(result.status, "succeeded");
  assert.equal(result.prompt_id, "prompt-123");
  assert.equal(result.recovered, true);
  assert.deepEqual(calls.map(([name]) => name), ["history", "output", "store"]);
  assert.equal((await dispatchStore.get("req-1")).state, "succeeded");
});

test("does not attempt recovery or requeue when submission outcome is unknown", async () => {
  const dispatchStore = createMemoryDispatchStore();
  await dispatchStore.claim({ requestId: "req-1", sourceImageRef: "nexora://source/original", workflowHash: `sha256:${createHash("sha256").update(stableStringify({ "1": { inputs: { image: "", text: "" } }, "9": { inputs: {} } })).digest("hex")}` });
  await dispatchStore.markUnknown("req-1");
  const { adapter, calls } = setup({ options: { dispatchStore } });
  await assert.rejects(adapter.recover("req-1"), { code: "DISPATCH_NOT_RECOVERABLE" });
  assert.equal(calls.length, 0);
});

test("returns a saved successful result without contacting ComfyUI", async () => {
  const dispatchStore = createMemoryDispatchStore();
  const first = setup({ options: { dispatchStore } });
  const result = await first.adapter.render(first.request);
  const second = setup({ options: { dispatchStore } });
  assert.deepEqual(await second.adapter.recover("req-1"), result);
  assert.equal(second.calls.length, 0);
});

test("reports a missing dispatch record without contacting ComfyUI", async () => {
  const { adapter, calls } = setup();
  await assert.rejects(adapter.recover("missing"), { code: "DISPATCH_RECORD_NOT_FOUND" });
  assert.equal(calls.length, 0);
});


test("a shared dispatch lease prevents concurrent recovery across adapter instances", async () => {
  const dispatchStore = createMemoryDispatchStore();
  const workflowHash = `sha256:${createHash("sha256").update(stableStringify({ "1": { inputs: { image: "", text: "" } }, "9": { inputs: {} } })).digest("hex")}`;
  await dispatchStore.claim({ requestId: "req-1", sourceImageRef: "nexora://source/original", workflowHash });
  await dispatchStore.markQueued("req-1", "prompt-123");

  let markHistoryStarted;
  const historyStarted = new Promise((resolve) => { markHistoryStarted = resolve; });
  let releaseHistory;
  const historyGate = new Promise((resolve) => { releaseHistory = resolve; });
  const first = setup({
    options: { dispatchStore },
    transport: {
      async getHistory() {
        markHistoryStarted();
        await historyGate;
        return { "prompt-123": { status: { completed: true }, outputs: { "9": { images: [{ filename: "render.png", subfolder: "", type: "output" }] } } } };
      }
    }
  });
  const pending = first.adapter.recover("req-1");
  await historyStarted;

  const second = setup({ options: { dispatchStore } });
  await assert.rejects(second.adapter.recover("req-1"), { code: "RECOVERY_ALREADY_CLAIMED" });
  assert.equal(second.calls.length, 0);

  releaseHistory();
  const result = await pending;
  assert.equal(result.status, "succeeded");
  assert.equal((await dispatchStore.get("req-1")).state, "succeeded");
});
