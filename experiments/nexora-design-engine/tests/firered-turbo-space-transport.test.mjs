import test from "node:test";
import assert from "node:assert/strict";
import { createFireRedTurboSpaceTransport, DEFAULT_SPACE_ORIGIN, DEFAULT_INFER_FN_INDEX } from "../model-adapters/firered-turbo-space-transport.mjs";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const SESSION = "123e4567-e89b-12d3-a456-426614174000";

function completedSse(eventId, output) {
  return `data: ${JSON.stringify({
    msg: "process_completed",
    event_id: eventId,
    success: true,
    output: { data: output }
  })}\n\n`;
}

test("joins the Gradio sse_v3 queue with the pinned fn_index and session hash", async () => {
  const calls = [];
  const transport = createFireRedTurboSpaceTransport({
    cryptoImpl: { randomUUID: () => SESSION },
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
    mimeType: "image/jpeg",
    prompt: "A clear interior design prompt",
    seed: 7
  });
  assert.deepEqual(result, { event_id: "event_12345678", session_hash: SESSION });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DEFAULT_SPACE_ORIGIN + "/gradio_api/queue/join");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.headers["x-gradio-user"], "api");
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.fn_index, DEFAULT_INFER_FN_INDEX);
  assert.equal(payload.session_hash, SESSION);
  assert.deepEqual(JSON.parse(payload.data[0]), ["data:image/jpeg;base64,QUJD"]);
  assert.equal(payload.data[1], "A clear interior design prompt");
  assert.equal(payload.data[2], 7);
  assert.equal(payload.data[3], false);
  assert.equal(payload.data[4], 3);
  assert.equal(payload.data[5], "fast");
  assert.equal(payload.data[6], 120);
});

test("reads the sse_v3 queue stream and validates the same-origin PNG output", async () => {
  const calls = [];
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/gradio_api/queue/data?")) {
        assert.equal(new URL(url).searchParams.get("session_hash"), SESSION);
        return new Response(completedSse("event_12345678", [
          { path: "/tmp/output.png", url: "/file=output.png" }, 42
        ]), { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      if (url.endsWith("/file=output.png")) {
        return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
      }
      throw new Error("Unexpected URL " + url);
    }
  });
  const result = await transport.getResult({ event_id: "event_12345678", session_hash: SESSION });
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
      if (url.includes("/gradio_api/queue/data?")) {
        return new Response(completedSse("event_12345678", [
          { url: "https://evil.example/output.png" }, 42
        ]), { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      throw new Error("Foreign output must not be fetched");
    }
  });
  await assert.rejects(
    transport.getResult({ event_id: "event_12345678", session_hash: SESSION }),
    (error) => error.code === "OUTPUT_ORIGIN_REJECTED"
  );
  assert.equal(calls.length, 1);
});

test("rejects malformed queue responses and unsupported runtime configuration", async () => {
  const malformed = createFireRedTurboSpaceTransport({
    cryptoImpl: { randomUUID: () => SESSION },
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

test("reports upstream process_completed failures without leaking details by default", async () => {
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async () => new Response(`data: ${JSON.stringify({
      msg: "process_completed",
      event_id: "event_12345678",
      success: false,
      output: { error: "internal GPU trace" }
    })}\n\n`, { status: 200, headers: { "content-type": "text/event-stream" } })
  });
  await assert.rejects(
    transport.getResult({ event_id: "event_12345678", session_hash: SESSION }),
    (error) => error.code === "UPSTREAM_RENDER_FAILED" && !error.message.includes("internal GPU trace")
  );
});

test("rejects invalid image bytes even when the upstream MIME says PNG", async () => {
  const transport = createFireRedTurboSpaceTransport({
    fetchImpl: async (url) => {
      if (url.includes("/gradio_api/queue/data?")) {
        return new Response(completedSse("event_12345678", [{ url: "/file=bad.png" }, 42]), {
          status: 200, headers: { "content-type": "text/event-stream" }
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200, headers: { "content-type": "image/png" }
      });
    }
  });
  await assert.rejects(
    transport.getResult({ event_id: "event_12345678", session_hash: SESSION }),
    (error) => error.code === "INVALID_OUTPUT_IMAGE"
  );
});
