import test from "node:test";
import assert from "node:assert/strict";
import { createComfyUiHttpTransport } from "../model-adapters/comfyui-http-transport.mjs";

const base = {
  baseUrl: "https://comfy.private.example",
  allowedOrigins: ["https://comfy.private.example"],
  authToken: "test-token",
  storeResult: async ({ requestId }) => ({ image_ref: `nexora://results/${requestId}` })
};

function response(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    headers: { get: (key) => headers[key.toLowerCase()] || null },
    json: async () => payload,
    arrayBuffer: async () => payload
  };
}

test("rejects non-allowlisted or credential-bearing endpoints", () => {
  assert.throws(() => createComfyUiHttpTransport({ ...base, baseUrl: "https://attacker.example" }), { code: "ORIGIN_NOT_ALLOWED" });
  assert.throws(() => createComfyUiHttpTransport({ ...base, baseUrl: "https://user:pass@comfy.private.example" }), { code: "INVALID_CONFIG" });
  assert.throws(() => createComfyUiHttpTransport({ ...base, baseUrl: "http://comfy.private.example" }), { code: "INVALID_CONFIG" });
});

test("uploads image with server-side bearer auth and returns only ComfyUI image name", async () => {
  let captured;
  const transport = createComfyUiHttpTransport({ ...base, fetchImpl: async (url, init) => {
    captured = { url, init };
    return response({ name: "upload_1.png", subfolder: "", type: "input" });
  }});
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const result = await transport.uploadImage({ bytes: png, mimeType: "image/png", filename: "source", signal: undefined });
  assert.equal(result.name, "upload_1.png");
  assert.equal(captured.url, "https://comfy.private.example/upload/image");
  assert.equal(captured.init.headers.Authorization, "Bearer test-token");
  assert.equal(captured.init.redirect, "error");
  assert.ok(captured.init.body instanceof FormData);
});

test("queues API-format workflow and retrieves history using fixed ComfyUI routes", async () => {
  const calls = [];
  const transport = createComfyUiHttpTransport({ ...base, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return url.endsWith("/prompt") ? response({ prompt_id: "job_123" }) : response({ job_123: { status: { completed: true } } });
  }});
  const queued = await transport.queuePrompt({ workflow: { "1": { class_type: "KSampler", inputs: {} } }, clientId: "req_1" });
  assert.equal(queued.prompt_id, "job_123");
  const history = await transport.getHistory("job_123");
  assert.equal(history.job_123.status.completed, true);
  assert.equal(calls[0].url, "https://comfy.private.example/prompt");
  assert.equal(JSON.parse(calls[0].init.body).client_id, "req_1");
  assert.equal(calls[1].url, "https://comfy.private.example/history/job_123");
});

test("fetches output only through the configured origin and blocks path traversal", async () => {
  let called;
  const transport = createComfyUiHttpTransport({ ...base, fetchImpl: async (url) => {
    called = url;
    return response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer, 200, { "content-type": "image/png" });
  }});
  const bytes = await transport.getOutput({ filename: "render.png", subfolder: "2026/session", type: "output" });
  assert.deepEqual([...bytes], [9, 8, 7]);
  assert.ok(called.startsWith("https://comfy.private.example/view?"));
  await assert.rejects(() => transport.getOutput({ filename: "../secret.png" }), { code: "INVALID_OUTPUT_REFERENCE" });
});

test("enforces output size and does not expose upstream response details", async () => {
  const transport = createComfyUiHttpTransport({ ...base, maxResponseBytes: 2, fetchImpl: async () => response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer, 200, { "content-type": "image/png" }) });
  await assert.rejects(() => transport.getOutput({ filename: "large.png" }), { code: "INVALID_OUTPUT" });
  const broken = createComfyUiHttpTransport({ ...base, fetchImpl: async () => { throw new Error("private endpoint details"); } });
  await assert.rejects(() => broken.getHistory("job_123"), (error) => error.code === "HISTORY_FAILED" && !error.message.includes("private endpoint"));
});

test("delegates result storage without logging or changing image bytes", async () => {
  let stored;
  const transport = createComfyUiHttpTransport({ ...base, storeResult: async (input) => {
    stored = input;
    return { image_ref: "nexora://immutable/result" };
  }});
  const input = { requestId: "r1", bytes: new Uint8Array([1]), mimeType: "image/png", metadata: { provider: "comfyui" } };
  const result = await transport.storeResult(input);
  assert.equal(result.image_ref, "nexora://immutable/result");
  assert.equal(stored, input);
});

test("rejects source bytes whose signature does not match the declared MIME type", async () => {
  const transport = createComfyUiHttpTransport({ ...base, fetchImpl: async () => { throw new Error("must not be called"); } });
  await assert.rejects(() => transport.uploadImage({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", filename: "fake", signal: undefined }), { code: "INVALID_IMAGE_SIGNATURE" });
});

test("rejects non-PNG output even when the endpoint responds successfully", async () => {
  const transport = createComfyUiHttpTransport({ ...base, fetchImpl: async () => response(new Uint8Array([1, 2, 3]).buffer, 200, { "content-type": "image/jpeg" }) });
  await assert.rejects(() => transport.getOutput({ filename: "wrong.jpg" }), { code: "INVALID_OUTPUT_MIME" });
});
