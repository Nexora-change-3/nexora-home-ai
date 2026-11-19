import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createComfyUiHttpTransport } from "../model-adapters/comfyui-http-transport.mjs";
import { createComfyUiRenderAdapter } from "../model-adapters/comfyui-render-adapter.mjs";

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

test("composes the guarded renderer with the allowlisted HTTP transport end to end", async () => {
  const workflow = {
    "10": { class_type: "LoadImage", inputs: { image: "placeholder.png" } },
    "20": { class_type: "TextEncode", inputs: { text: "placeholder" } },
    "30": { class_type: "SaveImage", inputs: {} }
  };
  const workflowHash = `sha256:${createHash("sha256").update(stableStringify(workflow)).digest("hex")}`;
  const calls = [];
  let stored;
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/upload/image")) {
      return new Response(JSON.stringify({ name: "source-immutable.png", type: "input", subfolder: "" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/prompt")) {
      const queued = JSON.parse(init.body);
      assert.equal(queued.prompt["10"].inputs.image, "source-immutable.png");
      assert.equal(queued.prompt["20"].inputs.text, "Create a materially different interior design.");
      return new Response(JSON.stringify({ prompt_id: "render_42" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/history/render_42")) {
      return new Response(JSON.stringify({ render_42: { status: { completed: true }, outputs: { "30": { images: [{ filename: "result.png", subfolder: "", type: "output" }] } } } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/view?")) return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { status: 200, headers: { "Content-Type": "image/png", "Content-Length": "3" } });
    throw new Error("Unexpected route");
  };

  const transport = createComfyUiHttpTransport({
    baseUrl: "https://comfy.private.example",
    allowedOrigins: ["https://comfy.private.example"],
    authToken: "server-only-token",
    fetchImpl: fakeFetch,
    storeResult: async (input) => {
      stored = input;
      return { image_ref: "nexora://results/immutable-42" };
    }
  });
  const adapter = createComfyUiRenderAdapter({
    transport,
    workflow,
    nodeInputs: {
      image: { node_id: "10", input_name: "image" },
      prompt: { node_id: "20", input_name: "text" }
    },
    outputNodeId: "30",
    modelId: "FireRedTeam/FireRed-Image-Edit-1.1",
    modelRevision: "1.1",
    workflowHash,
    timeoutMs: 5000,
    pollIntervalMs: 0,
    sleep: async () => {},
    cryptoImpl: globalThis.crypto
  });

  const result = await adapter.render({
    request_id: "nexora-test-42",
    source_image_ref: "nexora://source/original-kitchen",
    source_image: { bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), mime_type: "image/png" },
    design_brief: { render_instructions: "Create a materially different interior design." },
    safety_policy: { preserve_source: true }
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.image_ref, "nexora://results/immutable-42");
  assert.equal(result.prompt_id, "render_42");
  assert.deepEqual([...stored.bytes], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(stored.metadata.source_image_ref, "nexora://source/original-kitchen");
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ url }) => url.startsWith("https://comfy.private.example/")));
  assert.ok(calls.every(({ init }) => init.headers.Authorization === "Bearer server-only-token"));
  assert.equal(workflow["10"].inputs.image, "placeholder.png", "the pinned workflow template remains unchanged");
});
