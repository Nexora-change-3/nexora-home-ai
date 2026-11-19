import { writeFile } from "node:fs/promises";
import { createMemoryDispatchStore } from "../model-adapters/dispatch-ledger.mjs";
import { createFireRedTurboSpaceAdapter } from "../model-adapters/firered-turbo-space-adapter.mjs";
import { createFireRedTurboSpaceTransport } from "../model-adapters/firered-turbo-space-transport.mjs";

const sourceUrl = "https://upload.wikimedia.org/wikipedia/commons/f/f2/Kitchen_interior_design.jpg";
const sourceResponse = await fetch(sourceUrl, {
  headers: {
    "user-agent": "NEXORA-Design-Engine-smoke-test/1.0",
    referer: "https://commons.wikimedia.org/"
  },
  redirect: "error"
});
if (!sourceResponse.ok) throw new Error("Public smoke fixture download failed.");
const sourceBytes = new Uint8Array(await sourceResponse.arrayBuffer());
if (!sourceBytes.byteLength || sourceBytes.byteLength > 8 * 1024 * 1024) {
  throw new Error("Public smoke fixture is empty or too large.");
}
const sourceMime = (sourceResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
if (!["image/jpeg", "image/png", "image/webp"].includes(sourceMime)) {
  throw new Error("Public smoke fixture has an unsupported MIME type: " + sourceMime);
}

const prompt = [
  "Restyle this kitchen as a calm, high-end contemporary Scandinavian interior:",
  "natural light-oak cabinetry, pale warm limestone backsplash, refined matte metal hardware,",
  "integrated modern appliances, restrained styling, soft daylight and layered warm task lighting.",
  "Preserve the original camera viewpoint, room geometry, windows, wall openings, countertop run,",
  "sink and cooking-zone positions. Do not move walls, windows, doors or fixed services.",
  "Change finishes, cabinetry and decor only. Photorealistic architectural interior photography,",
  "realistic materials, credible construction details, balanced exposure."
].join(" ");

const adapter = createFireRedTurboSpaceAdapter({
  transport: createFireRedTurboSpaceTransport({ debugUpstreamErrors: true }),
  dispatchStore: createMemoryDispatchStore(),
  status: "ready",
  timeoutMs: 150000,
  storeResult: async ({ bytes, mimeType, metadata }) => {
    if (mimeType !== "image/png") throw new Error("Smoke output was not PNG.");
    await writeFile("firered-smoke-output.png", bytes);
    return { image_ref: "ci-artifact://firered-smoke-output.png", metadata };
  }
});

let result;
try {
  result = await adapter.render({
    request_id: "firered-live-smoke-2026-11-19",
    source_image_ref: "public-fixture://wikimedia-kitchen",
    source_image: { bytes: sourceBytes, mime_type: sourceMime },
    design_brief: { render_instructions: prompt },
    safety_policy: {
      external_image_processing_consent: true,
      external_provider: "huggingface-zero-gpu"
    },
    seed: 42
  });
} catch (error) {
  if (error.debug_detail) console.error("FIRERED_UPSTREAM_DEBUG", error.debug_detail);
  console.error("FIRERED_ADAPTER_ERROR", error.code || error.name, error.message);
  throw error;
}

if (result.status !== "succeeded" || result.image_ref !== "ci-artifact://firered-smoke-output.png") {
  throw new Error("FireRed adapter returned an invalid result.");
}
console.log("FIRERED_TURBO_LIVE_OK", JSON.stringify({
  provider: result.provider,
  model_id: result.model_id,
  model_revision: result.model_revision,
  space_revision: result.space_revision,
  event_id: result.event_id,
  seed: result.seed,
  elapsed_ms: result.elapsed_ms,
  image_ref: result.image_ref
}));
