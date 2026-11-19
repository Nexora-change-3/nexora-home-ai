import test from "node:test";
import assert from "node:assert/strict";
import { createFireRedTurboSpaceTransport, DEFAULT_SPACE_ORIGIN } from "../model-adapters/firered-turbo-space-transport.mjs";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

test("submits the pinned FireRed request with base64 image JSON and fixed fast settings", async () => {
  const calls = [];
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ event_id: "event_12345678" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });
  const result = await transport.submit({
    imageBytes: new Uint8Array([65, 66, 67]),
    prompt: "A clear interior design prompt",
    seed: 7
  });
  assert.deepEqual(result, { event_id: "event_12345678" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DEFAULT_SPACE_ORIGIN + "/gradio_api/call/infer");
  assert.equal(calls[0].init.redirect, "error");
  const payload = JSON.parse(calls[0].init.body);
  assert.deepEqual(JSON.parse(payload.data[0]), ["QUJD"]);
  assert.equal(payload.data[1], "A clear interior design prompt");
  assert.equal(payload.data[2], 7);
  assert.equal(payload.data[3], false);
  assert.equal(payload.data[4], 3);
  assert.equal(payload.data[5], "fast");
  assert.equal(payload.data[6], 120);
});

test("reads a completed SSE event and validates the same-origin PNG output", async () => {
  const calls = [];
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/gradio_api/call/infer/event_12345678")) {
        return new Response(
          'event: complete\ndata: [{"path":"/tmp/output.png","url":"/file=output.png"},42]\n\n',
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      }
      if (url.endsWith("/file=output.png")) {
        return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
      }
      throw new Error("Unexpected URL " + url);
    }
  });
  const result = await transport.getResult("event_12345678");
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual([...result.bytes], [...PNG]);
  assert.equal(result.seed, 42);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[1].init.redirect, "error");
});

test("rejects a foreign output URL before fetching it", async () => {
  const calls = [];
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith("/gradio_api/call/infer/event_12345678")) {
        return new Response(
          'event: complete\ndata: [{"url":"https://evil.example/output.png"},42]\n\n',
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      }
      throw new Error("Foreign output must not be fetched");
    }
  });
  await assert.rejects(
    transport.getResult("event_12345678"),
    (error) => error.code === "OUTPUT_ORIGIN_REJECTED"
  );
  assert.equal(calls.length, 1);
});

test("rejects malformed queue responses and unsupported runtime configuration", async () => {
  const malformed = createFireRedTurboSpaceTransport({
    fetchImpl: async () => new Response(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  });
  await assert.rejects(
    malformed.submit({ imageBytes: new Uint8Array([1]), prompt: "Prompt" }),
    (error) => error.code === "QUEUE_OUTCOME_UNKNOWN"
  );
  await assert.rejects(
    malformed.submit({ imageBytes: new Uint8Array([1]), prompt: "Prompt", steps: 8 }),
    (error) => error.code === "UNSUPPORTED_RENDER_CONFIG"
  );
});

test("rejects invalid image bytes even when the upstream MIME says PNG", async () => {
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url) => {
      if (url.endsWith("/gradio_api/call/infer/event_12345678")) {
        return new Response('event: complete\ndata: [{"url":"/file=bad.png"},42]\n\n', {
          status: 200, headers: { "content-type": "text/event-stream" }
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { "content-type": "image/png" }
      });
    }
  });
  await assert.rejects(
    transport.getResult("event_12345678"),
    (error) => error.code === "INVALID_OUTPUT_IMAGE"
  );
});
