import test from "node:test";
import assert from "node:assert/strict";
import { createAdapterRegistry } from "../model-adapters/adapter-registry.mjs";

const request = {
  request_id: "render-001",
  source_image_ref: "original-photo-ref",
  design_brief: { concept_id: "warm-natural" },
  safety_policy: { preserve_unknowns: true }
};

function readyAdapter(overrides = {}) {
  return {
    id: "test-renderer",
    provider: "test",
    modelId: "test-model",
    status: "ready",
    capabilities: ["image-edit", "multi-concept"],
    async render(input) {
      return { request_id: input.request_id, status: "succeeded", image_ref: "result-ref" };
    },
    ...overrides
  };
}

test("lists adapter metadata without exposing executable functions", () => {
  const registry = createAdapterRegistry({ adapters: [readyAdapter()] });
  const [item] = registry.list();
  assert.equal(item.id, "test-renderer");
  assert.equal("render" in item, false);
});

test("does not resolve planned adapters for execution", () => {
  const registry = createAdapterRegistry({ adapters: [{
    id: "firered-image-edit",
    provider: "FireRedTeam",
    modelId: "FireRed-Image-Edit-1.0",
    status: "planned",
    runtime: "external-gpu",
    capabilities: ["image-edit"]
  }] });
  assert.throws(
    () => registry.resolve({ id: "firered-image-edit" }),
    (error) => error.code === "ADAPTER_NOT_READY"
  );
});

test("rejects duplicate adapter identifiers", () => {
  const registry = createAdapterRegistry({ adapters: [readyAdapter()] });
  assert.throws(
    () => registry.register(readyAdapter()),
    (error) => error.code === "DUPLICATE_ADAPTER"
  );
});

test("checks required capabilities before dispatch", () => {
  const registry = createAdapterRegistry({ adapters: [readyAdapter()] });
  assert.throws(
    () => registry.resolve({ id: "test-renderer", requiredCapabilities: ["local-edit-mask"] }),
    (error) => error.code === "CAPABILITY_UNSUPPORTED"
  );
});

test("dispatches a valid render request to the selected adapter", async () => {
  let received;
  const adapter = readyAdapter({
    async render(input) {
      received = input;
      return { request_id: input.request_id, status: "succeeded", image_ref: "rendered-image" };
    }
  });
  const registry = createAdapterRegistry({ adapters: [adapter] });
  const result = await registry.render({ id: adapter.id, request });
  assert.equal(received, request);
  assert.equal(result.image_ref, "rendered-image");
});

test("fails closed when required source or safety data is missing", async () => {
  const registry = createAdapterRegistry({ adapters: [readyAdapter()] });
  await assert.rejects(
    registry.render({ id: "test-renderer", request: { request_id: "missing-source" } }),
    (error) => error.code === "INVALID_RENDER_REQUEST"
  );
});

test("rejects malformed provider responses", async () => {
  const registry = createAdapterRegistry({ adapters: [readyAdapter({
    async render() { return { request_id: "wrong-id", status: "succeeded" }; }
  })] });
  await assert.rejects(
    registry.render({ id: "test-renderer", request }),
    (error) => error.code === "INVALID_RENDER_RESPONSE"
  );
});

test("filters unavailable adapters when requested", () => {
  const registry = createAdapterRegistry({ adapters: [
    readyAdapter(),
    { id: "later", provider: "vendor", modelId: "model", status: "planned", capabilities: [] }
  ] });
  assert.deepEqual(registry.list({ includeUnavailable: false }).map((item) => item.id), ["test-renderer"]);
});
