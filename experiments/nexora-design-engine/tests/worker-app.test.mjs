import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.mjs";
import { APP_HTML } from "../app-shell.mjs";

function sameOriginRequest(path, init = {}) {
  return new Request("https://nexora-engine.example" + path, {
    ...init,
    headers: { origin: "https://nexora-engine.example", ...(init.headers || {}) }
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
  assert.match(html, /FLUX\.2 Dev/);
  assert.match(html, /Llama 3\.3 70B/);
  assert.match(html, /externalProcessingConsent/);
  assert.match(html, /indexedDB/);
});

test("serves health metadata without exposing credentials or image data", async () => {
  const response = await worker.fetch(sameOriginRequest("/api/health"), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.provider, "cloudflare-workers-ai");
  assert.match(body.model, /flux-2-dev/);
  assert.equal(body.design_brain_model, "@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  assert.equal(body.version, "1.4.0");
  assert.equal(body.paid_fallback_enabled, false);
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

test("requires consent before photo analysis", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "false");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
});

test("requires an original image for AI design analysis", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "true");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "SOURCE_IMAGE_REQUIRED");
});

test("does not render an image without explicit processing consent", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "false");
  const response = await worker.fetch(sameOriginRequest("/api/render", { method: "POST", body: form }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "EXTERNAL_PROCESSING_CONSENT_REQUIRED");
});

test("rejects an unknown room type before invoking vision", async () => {
  const form = new FormData();
  form.append("externalProcessingConsent", "true");
  form.append("image", new Blob([Uint8Array.from([255,216,255,0])], { type: "image/jpeg" }), "room.jpg");
  form.append("roomType", "spaceship");
  const response = await worker.fetch(sameOriginRequest("/api/concepts", { method: "POST", body: form }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_ROOM_TYPE");
});

test("the delivered app client script is syntactically valid", () => {
  const match = APP_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, "App shell must contain its client application script.");
  assert.doesNotThrow(() => new Function(match[1]));
});

test("does not ask for a Hugging Face token and discloses the Cloudflare free-tier cap", async () => {
  const response = await worker.fetch(new Request("https://nexora.test/"), {});
  const html = await response.text();
  assert.doesNotMatch(html, /hfToken|X-HF-Token|Hugging Face/);
  assert.match(html, /Cloudflare Workers AI/);
  assert.match(html, /Llama 3.3 70B/);
  assert.match(html, /Moondream/);
  assert.match(html, /3 генерации в сутки/);
  assert.match(html, /платные сервисы не подключаются|платный резервный сервис отключён/i);
});
