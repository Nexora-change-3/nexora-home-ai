const DEFAULT_SPACE_ORIGIN = "https://someone-in-the-world-firered-experimental-turbo.hf.space";
const DEFAULT_MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function fail(code, message) { const error = new Error(message); error.code = code; return error; }
function assert(condition, code, message) { if (!condition) throw fail(code, message); }

function toDataUrl(input, mimeType) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function resolveHandle(input) {
  if (typeof input === "string") {
    try { input = JSON.parse(input); } catch { throw fail("INVALID_EVENT_HANDLE", "Saved FireRed event handle is invalid."); }
  }
  assert(input && typeof input.event_id === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(input.event_id),
    "INVALID_EVENT_HANDLE", "A valid FireRed event_id is required.");
  return input;
}

function resolveImageUrl(imageData, origin) {
  const rawUrl = typeof imageData === "string" ? imageData : imageData && typeof imageData.url === "string" ? imageData.url : null;
  if (rawUrl) {
    let url;
    try { url = new URL(rawUrl, origin); } catch { throw fail("INVALID_OUTPUT_URL", "FireRed returned an invalid output URL."); }
    assert(url.protocol === "https:" && url.origin === origin, "OUTPUT_ORIGIN_REJECTED", "FireRed output must be served by the pinned Space origin.");
    return url.toString();
  }
  const path = imageData && typeof imageData.path === "string" ? imageData.path : null;
  assert(path && path.length <= 2048, "OUTPUT_NOT_FOUND", "FireRed Space returned no accessible output image.");
  return new URL("/gradio_api/file=" + encodeURIComponent(path), origin).toString();
}

function validateImageBytes(bytes, mimeType, maxBytes) {
  assert(bytes.byteLength > 0 && bytes.byteLength <= maxBytes, "INVALID_OUTPUT_SIZE", "FireRed output is empty or exceeds the configured size limit.");
  if (mimeType === "image/png") {
    assert(bytes.byteLength >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value),
      "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid PNG signature."); return;
  }
  if (mimeType === "image/jpeg") {
    assert(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid JPEG signature."); return;
  }
  if (mimeType === "image/webp") {
    assert(bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8,12)) === "WEBP",
      "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid WebP signature."); return;
  }
  throw fail("UNSUPPORTED_OUTPUT_TYPE", "FireRed returned an unsupported image type.");
}

async function fetchPinned(fetchImpl, url, init, origin) {
  let response = await fetchImpl(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    assert(location, "UNSAFE_REDIRECT", "FireRed returned a redirect without a location.");
    const next = new URL(location, url);
    assert(next.protocol === "https:" && next.origin === origin, "REDIRECT_ORIGIN_REJECTED", "FireRed attempted to redirect outside the pinned Space origin.");
    const method = String(init.method || "GET").toUpperCase();
    if (method === "POST") assert([307, 308].includes(response.status), "UNSAFE_POST_REDIRECT", "FireRed returned an unsafe redirect for a queue submission.");
    response = await fetchImpl(next.toString(), { ...init, redirect: "manual" });
    assert(!(response.status >= 300 && response.status < 400), "REDIRECT_LOOP_BLOCKED", "FireRed returned a second redirect.");
  }
  return response;
}

async function readCompletion(response, { debugUpstreamErrors = false } = {}) {
  const reader = response.body?.getReader?.();
  assert(reader, "INVALID_SSE_RESPONSE", "FireRed returned no readable event stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary < 0) break;
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventLine = block.split("\n").find((line) => line.startsWith("event:"));
        const eventName = eventLine ? eventLine.slice(6).trim() : "message";
        const dataLines = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
        if (!dataLines.length) continue;
        const raw = dataLines.join("\n");
        if (eventName === "error") {
          const error = fail("UPSTREAM_RENDER_FAILED", "FireRed Space reported an inference error.");
          if (debugUpstreamErrors) error.debug_detail = raw.slice(0, 500);
          throw error;
        }
        if (eventName === "complete") {
          let output;
          try { output = JSON.parse(raw); } catch { throw fail("INVALID_SSE_MESSAGE", "FireRed returned malformed completion data."); }
          if (output === null) throw fail("UPSTREAM_RENDER_FAILED", "FireRed Space returned an empty completion.");
          return output;
        }
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
  throw fail("INCOMPLETE_UPSTREAM_RESPONSE", "FireRed event stream ended before this generation completed.");
}

export function createFireRedTurboSpaceTransport({ baseUrl = DEFAULT_SPACE_ORIGIN, fetchImpl = globalThis.fetch,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES, debugUpstreamErrors = false } = {}) {
  assert(typeof fetchImpl === "function", "INVALID_FETCH", "A fetch implementation is required.");
  const parsed = new URL(baseUrl);
  assert(parsed.protocol === "https:" && parsed.hostname === "someone-in-the-world-firered-experimental-turbo.hf.space" &&
    !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash,
    "SPACE_ORIGIN_NOT_ALLOWED", "Only the pinned FireRed Turbo Hugging Face Space origin is allowed.");
  assert(Number.isInteger(maxOutputBytes) && maxOutputBytes > 0, "INVALID_LIMIT", "maxOutputBytes must be a positive integer.");
  const origin = parsed.origin;

  async function submit({ imageBytes, mimeType = "image/jpeg", prompt, seed = 42, randomizeSeed = false,
    steps = 3, mode = "fast", gpuDuration = 120, signal } = {}) {
    const bytes = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes || []);
    assert(bytes.byteLength > 0, "SOURCE_IMAGE_UNAVAILABLE", "Source image bytes are required.");
    assert(["image/jpeg", "image/png", "image/webp"].includes(mimeType), "UNSUPPORTED_IMAGE_TYPE", "Source image MIME type is unsupported.");
    assert(typeof prompt === "string" && prompt.trim() && prompt.length <= 12000, "INVALID_PROMPT", "A non-empty prompt of at most 12000 characters is required.");
    assert(Number.isInteger(seed) && seed >= 0 && seed <= 2147483647, "INVALID_SEED", "Seed is invalid.");
    assert(steps === 3 && mode === "fast" && gpuDuration === 120, "UNSUPPORTED_RENDER_CONFIG", "This pinned Turbo Space adapter supports only fast mode, 3 steps and 120 seconds GPU duration.");
    const payload = { data: [JSON.stringify([toDataUrl(bytes, mimeType)]), prompt, seed, randomizeSeed, steps, mode, gpuDuration] };
    let response;
    try {
      response = await fetchPinned(fetchImpl, origin + "/gradio_api/call/infer", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json", "x-gradio-user": "api" },
        body: JSON.stringify(payload), signal
      }, origin);
    } catch (cause) {
      const safeRedirectCodes = new Set(["REDIRECT_ORIGIN_REJECTED", "UNSAFE_POST_REDIRECT", "UNSAFE_REDIRECT", "REDIRECT_LOOP_BLOCKED"]);
      const code = safeRedirectCodes.has(cause?.code) ? cause.code : "QUEUE_OUTCOME_UNKNOWN";
      const message = code === "QUEUE_OUTCOME_UNKNOWN"
        ? "FireRed queue submission could not be confirmed; do not resubmit this request."
        : "FireRed returned an unsafe redirect. The source image was not sent to the redirect target.";
      const error = fail(code, message);
      error.debug_detail = String(cause?.debug_detail || cause?.name || "network_error").slice(0, 160); throw error;
    }
    if (!response.ok) {
      const error = fail("QUEUE_OUTCOME_UNKNOWN", `FireRed named endpoint returned HTTP ${response.status}; do not resubmit this request.`);
      error.debug_detail = `HTTP_${response.status}`; throw error;
    }
    let result;
    try { result = await response.json(); } catch { throw fail("QUEUE_OUTCOME_UNKNOWN", "FireRed returned an invalid queue response; do not resubmit this request."); }
    assert(result && typeof result.event_id === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(result.event_id),
      "QUEUE_OUTCOME_UNKNOWN", "FireRed returned no valid event identifier; do not resubmit this request.");
    return { event_id: result.event_id };
  }

  async function getResult(eventHandle, { signal } = {}) {
    const handle = resolveHandle(eventHandle);
    let response;
    try {
      response = await fetchPinned(fetchImpl, origin + "/gradio_api/call/infer/" + encodeURIComponent(handle.event_id), {
        headers: { accept: "text/event-stream" }, signal
      }, origin);
    } catch { throw fail("RESULT_FETCH_FAILED", "FireRed completion stream could not be reached."); }
    assert(response.ok, "RESULT_FETCH_FAILED", "FireRed completion stream returned an error.");
    const output = await readCompletion(response, { debugUpstreamErrors });
    assert(Array.isArray(output) && output.length >= 1, "INVALID_UPSTREAM_RESPONSE", "FireRed completion did not include result data.");
    const imageData = output[0];
    const seed = Number.isInteger(output[1]) ? output[1] : null;
    const imageUrl = resolveImageUrl(imageData, origin);
    let imageResponse;
    try { imageResponse = await fetchPinned(fetchImpl, imageUrl, { headers: { accept: "image/png,image/jpeg,image/webp" }, signal }, origin); }
    catch { throw fail("OUTPUT_FETCH_FAILED", "FireRed output image could not be downloaded."); }
    assert(imageResponse.ok, "OUTPUT_FETCH_FAILED", "FireRed output image returned an error.");
    const mimeType = (imageResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    validateImageBytes(bytes, mimeType, maxOutputBytes);
    return { bytes, mimeType, seed };
  }
  return Object.freeze({ submit, getResult, origin });
}

export { DEFAULT_SPACE_ORIGIN };
