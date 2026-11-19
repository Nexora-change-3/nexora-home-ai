import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.mjs";
import { APP_HTML } from "../app-shell.mjs";

function sameOriginRequest(path, init = {}) {
  return new Request("https://nexora-engine.example" + path, {
    ...init,
    headers: {
      origin: "https://nexora-engine.example",
      ...(init.headers || {})
    }
  });
}

test("serves the standalone app with restrictive security headers", async () => {
  const response = await worker.fetch(sameOriginRequest("/"), {});
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /NEXORA Design Engine/);
  assert.match(html, /externalProcessingConsent/);
  assert.match(html, /indexedDB/);
});

test("serves health metadata without exposing credentials or image data", async () => {
  const response = await worker.fetch(sameOriginRequest("/api/health"), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.provider, "huggingface-zero-gpu");
  assert.equal(body.output_storage, "Cloudflare D1 temporary; browser IndexedDB persistent");
  assert.equal(JSON.stringify(body).includes("token"), false);
});

test("rejects cross-origin browser requests", async () => {
  const response = await worker.fetch(new Request("https://nexora-engine.example/api/health", {
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "ORIGIN_REJECTED");
});

test("returns exactly three structurally different design directions", async () => {
  const response = await worker.fetch(sameOriginRequest("/api/concepts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceImageId: "sha256:" + "a".repeat(64),
      roomType: "kitchen",
      stylePreference: "designer-led",
      userBrief: "Create a more functional kitchen with distinctive materials.",
      intendedUse: "Daily cooking and family meals",
      fixed: ["Keep the window and sink location"],
      preserve: ["Keep the existing room envelope"],
      replaceable: ["Cabinet fronts and lighting"]
    })
  }), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.source_image_immutable, true);
  assert.equal(body.concepts.length, 3);
  assert.equal(new Set(body.concepts.map((x) => x.concept_id)).size, 3);
  assert.equal(new Set(body.concepts.map((x) => x.name)).size, 3);
  assert.equal(new Set(body.concepts.map((x) => x.thesis)).size, 3);
  assert.ok(body.concepts.every((x) => x.materials && x.lighting && x.layout));
});

test("does not transmit an image without explicit third-party processing consent", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "false");
  const response = await worker.fetch(sameOriginRequest("/api/render", {
    method: "POST",
    body: form
  }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
});

test("rejects an unknown room type before any image-processing request", async () => {
  const response = await worker.fetch(sameOriginRequest("/api/concepts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceImageId: "sha256:" + "b".repeat(64),
      roomType: "spaceship",
      stylePreference: "designer-led"
    })
  }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ROOM_TYPE");
});

test("the delivered app client script is syntactically valid", () => {
  const match = APP_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "App shell must contain its client application script.");
  assert.doesNotThrow(() => new Function(match[1]));
});
