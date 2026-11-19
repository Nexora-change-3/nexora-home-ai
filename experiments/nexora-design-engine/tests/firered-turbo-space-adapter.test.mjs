import test from "node:test";
import assert from "node:assert/strict";
import { createFireRedTurboSpaceAdapter } from "../model-adapters/firered-turbo-space-adapter.mjs";
import { createMemoryDispatchStore } from "../model-adapters/dispatch-ledger.mjs";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const HANDLE = { event_id: "event_12345678", session_hash: "123e4567-e89b-12d3-a456-426614174000" };

function makeRequest(overrides = {}) {
  return {
    request_id: "request-0001",
    source_image_ref: "nexora://source/original-1",
    source_image: { bytes: new Uint8Array([1, 2, 3]), mime_type: "image/jpeg" },
    design_brief: { render_instructions: "Restyle this room with warm natural materials." },
    safety_policy: {
      external_image_processing_consent: true,
      external_provider: "huggingface-zero-gpu"
    },
    seed: 42,
    ...overrides
  };
}

function makeAdapter({ transport = {}, storeResult, dispatchStore = createMemoryDispatchStore(), now } = {}) {
  return createFireRedTurboSpaceAdapter({
    transport: {
      submit: async () => HANDLE,
      getResult: async () => ({ bytes: PNG, mimeType: "image/png", seed: 42 }),
      ...transport
    },
    dispatchStore,
    storeResult: storeResult || (async () => ({ image_ref: "nexora://result/render-1" })),
    now
  });
}

test("requires explicit provider-specific consent before sending the source image", async () => {
  let submitted = 0;
  const adapter = makeAdapter({ transport: { submit: async () => { submitted += 1; return HANDLE; } } });
  const request = makeRequest({
    safety_policy: { external_image_processing_consent: false, external_provider: "huggingface-zero-gpu" }
  });
  await assert.rejects(adapter.render(request), (error) => error.code === "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
  assert.equal(submitted, 0);
});

test("renders once, stores a new immutable result and returns pinned provenance", async () => {
  let submits = 0;
  let stored;
  let receivedHandle;
  const dispatchStore = createMemoryDispatchStore();
  const adapter = makeAdapter({
    dispatchStore,
    transport: {
      submit: async () => { submits += 1; return HANDLE; },
      getResult: async (handle) => { receivedHandle = handle; return { bytes: PNG, mimeType: "image/png", seed: 42 }; }
    },
    storeResult: async (value) => {
      stored = value;
      return { image_ref: "nexora://result/render-1" };
    }
  });
  const result = await adapter.render(makeRequest());
  assert.equal(result.status, "succeeded");
  assert.equal(result.image_ref, "nexora://result/render-1");
  assert.equal(result.provider, "huggingface-zero-gpu");
  assert.match(result.model_revision, /FireRed-Image-Edit-1.1/);
  assert.match(result.space_revision, /91b831cc23f0ee770fc2d9c80a4619339a245275/);
  assert.equal(result.event_id, HANDLE.event_id);
  assert.equal(submits, 1);
  assert.deepEqual(receivedHandle, HANDLE);
  assert.equal(stored.metadata.source_image_ref, "nexora://source/original-1");
  assert.equal(stored.metadata.provider, "huggingface-zero-gpu");
  assert.notEqual(result.image_ref, "nexora://source/original-1");
  const duplicate = await adapter.render(makeRequest());
  assert.deepEqual(duplicate, result);
  assert.equal(submits, 1);
});

test("marks an ambiguous submission unknown and blocks a duplicate retry", async () => {
  let submits = 0;
  const dispatchStore = createMemoryDispatchStore();
  const adapter = makeAdapter({
    dispatchStore,
    transport: {
      submit: async () => { submits += 1; throw new Error("connection dropped after POST"); }
    }
  });
  await assert.rejects(adapter.render(makeRequest()), (error) => error.code === "QUEUE_OUTCOME_UNKNOWN");
  await assert.rejects(adapter.render(makeRequest()), (error) => error.code === "DUPLICATE_SUBMISSION_BLOCKED");
  assert.equal(submits, 1);
});

test("recovers a queued event using its saved event and session handle without resubmitting", async () => {
  let submits = 0;
  let resultCalls = 0;
  let receivedHandle;
  const dispatchStore = createMemoryDispatchStore();
  const adapter = makeAdapter({
    dispatchStore,
    transport: {
      submit: async () => { submits += 1; return HANDLE; },
      getResult: async (handle) => {
        receivedHandle = handle;
        resultCalls += 1;
        if (resultCalls === 1) throw new Error("temporary stream interruption");
        return { bytes: PNG, mimeType: "image/png", seed: 42 };
      }
    },
    storeResult: async () => ({ image_ref: "nexora://result/recovered-1" })
  });
  await assert.rejects(adapter.render(makeRequest()));
  const recovered = await adapter.recover("request-0001");
  assert.equal(recovered.status, "succeeded");
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.image_ref, "nexora://result/recovered-1");
  assert.deepEqual(receivedHandle, HANDLE);
  assert.equal(submits, 1);
  assert.equal(resultCalls, 2);
});

test("blocks overwriting the original source image", async () => {
  const adapter = makeAdapter({
    storeResult: async () => ({ image_ref: "nexora://source/original-1" })
  });
  await assert.rejects(adapter.render(makeRequest()), (error) => error.code === "SOURCE_OVERWRITE_BLOCKED");
});
