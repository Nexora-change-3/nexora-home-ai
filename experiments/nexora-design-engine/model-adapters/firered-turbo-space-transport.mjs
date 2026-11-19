const DEFAULT_SPACE_ORIGIN = "https://someone-in-the-world-firered-experimental-turbo.hf.space";
const DEFAULT_MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const DEFAULT_INFER_FN_INDEX = 3;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}

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
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed.event_id === "string" && typeof parsed.session_hash === "string") return parsed;
    } catch {}
    throw fail("INVALID_EVENT_HANDLE", "Saved FireRed event handle is invalid.");
  }
  assert(input && typeof input.event_id === "string" && typeof input.session_hash === "string",
    "INVALID_EVENT_HANDLE", "A FireRed event_id and session_hash are required.");
  return input;
}

function resolveImageUrl(imageData, origin) {
  const rawUrl = typeof imageData === "string"
    ? imageData
    : imageData && typeof imageData.url === "string"
      ? imageData.url
      : null;
  if (rawUrl) {
    let url;
    try { url = new URL(rawUrl, origin); }
    catch { throw fail("INVALID_OUTPUT_URL", "FireRed Space returned an invalid output URL."); }
    assert(url.protocol === "https:" && url.origin === origin, "OUTPUT_ORIGIN_REJECTED",
      "FireRed output must be served by the pinned Space origin.");
    return url.toString();
  }
  const path = imageData && typeof imageData.path === "string" ? imageData.path : null;
  assert(path && path.length <= 2048, "OUTPUT_NOT_FOUND", "FireRed Space returned no accessible output image.");
  return new URL("/gradio_api/file=" + encodeURIComponent(path), origin).toString();
}

function validateImageBytes(bytes, mimeType, maxBytes) {
  assert(bytes.byteLength > 0 && bytes.byteLength <= maxBytes, "INVALID_OUTPUT_SIZE",
    "FireRed output is empty or exceeds the configured size limit.");
  if (mimeType === "image/png") {
    assert(bytes.byteLength >= PNG_SIGNATURE.length &&
      PNG_SIGNATURE.every((value, index) => bytes[index] === value),
    "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid PNG signature.");
    return;
  }
  if (mimeType === "image/jpeg") {
    assert(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid JPEG signature.");
    return;
  }
  if (mimeType === "image/webp") {
    assert(bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
    "INVALID_OUTPUT_IMAGE", "FireRed output does not contain a valid WebP signature.");
    return;
  }
  throw fail("UNSUPPORTED_OUTPUT_TYPE", "FireRed returned an unsupported image type.");
}

async function readQueueCompletion(response, eventId, { signal, debugUpstreamErrors = false } = {}) {
  const reader = response.body?.getReader?.();
  assert(reader, "INVALID_SSE_RESPONSE", "FireRed queue returned no readable event stream.");
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
        const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        let message;
        try { message = JSON.parse(dataLine.slice(5).trimStart()); }
        catch { throw fail("INVALID_SSE_MESSAGE", "FireRed queue returned malformed event data."); }
        if (message.event_id !== eventId) continue;
        if (message.msg === "process_completed") {
          if (message.success === false) {
            const error = fail("UPSTREAM_RENDER_FAILED", "FireRed Space reported an inference error.");
            if (debugUpstreamErrors) {
              const detail = message.output?.error || message.output?.message || message.output;
              error.debug_detail = String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 500);
            }
            throw error;
          }
          return message.output;
        }
        if (message.msg === "queue_full" || message.msg === "unexpected_error") {
          const error = fail("UPSTREAM_RENDER_FAILED", "FireRed Space could not process the queued request.");
          if (debugUpstreamErrors) error.debug_detail = String(message.message || message.msg).slice(0, 500);
          throw error;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  throw fail("INCOMPLETE_UPSTREAM_RESPONSE", "FireRed queue stream ended before this event completed.");
}

export function createFireRedTurboSpaceTransport({
  baseUrl = DEFAULT_SPACE_ORIGIN,
  fetchImpl = globalThis.fetch,
  cryptoImpl = globalThis.crypto,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  debugUpstreamErrors = false
} = {}) {
  assert(typeof fetchImpl === "function", "INVALID_FETCH", "A fetch implementation is required.");
  const parsed = new URL(baseUrl);
  assert(parsed.protocol === "https:" && parsed.hostname === "someone-in-the-world-firered-experimental-turbo.hf.space" &&
    !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash,
  "SPACE_ORIGIN_NOT_ALLOWED", "Only the pinned FireRed Turbo Hugging Face Space origin is allowed.");
  assert(Number.isInteger(maxOutputBytes) && maxOutputBytes > 0, "INVALID_LIMIT", "maxOutputBytes must be a positive integer.");
  assert(typeof cryptoImpl?.randomUUID === "function", "CRYPTO_UNAVAILABLE", "Secure session IDs are required.");
  const origin = parsed.origin;

  async function submit({ imageBytes, mimeType = "image/jpeg", prompt, seed = 42, randomizeSeed = false, steps = 3, mode = "fast", gpuDuration = 120, signal } = {}) {
    const bytes = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes || []);
    assert(bytes.byteLength > 0, "SOURCE_IMAGE_UNAVAILABLE", "Source image bytes are required.");
    assert(["image/jpeg", "image/png", "image/webp"].includes(mimeType), "UNSUPPORTED_IMAGE_TYPE", "Source image MIME type is unsupported.");
    assert(typeof prompt === "string" && prompt.trim() && prompt.length <= 12000,
      "INVALID_PROMPT", "A non-empty prompt of at most 12000 characters is required.");
    assert(Number.isInteger(seed) && seed >= 0 && seed <= 2147483647, "INVALID_SEED", "Seed is invalid.");
    assert(steps === 3 && mode === "fast" && gpuDuration === 120,
      "UNSUPPORTED_RENDER_CONFIG", "This pinned Turbo Space adapter supports only fast mode, 3 steps and 120 seconds GPU duration.");

    const sessionHash = cryptoImpl.randomUUID();
    const payload = {
      data: [JSON.stringify([toDataUrl(bytes, mimeType)]), prompt, seed, randomizeSeed, steps, mode, gpuDuration],
      fn_index: DEFAULT_INFER_FN_INDEX,
      session_hash: sessionHash
    };
    let response;
    try {
      response = await fetchImpl(origin + "/gradio_api/queue/join", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-gradio-user": "api"
        },
        body: JSON.stringify(payload),
        signal,
        redirect: "error"
      });
    } catch {
      throw fail("QUEUE_OUTCOME_UNKNOWN", "FireRed queue submission could not be confirmed; do not resubmit this request.");
    }
    assert(response.ok, "QUEUE_OUTCOME_UNKNOWN", "FireRed Space did not confirm the queue submission.");
    let result;
    try { result = await response.json(); }
    catch { throw fail("QUEUE_OUTCOME_UNKNOWN", "FireRed Space returned an invalid queue response."); }
    assert(result && typeof result.event_id === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(result.event_id),
      "QUEUE_OUTCOME_UNKNOWN", "FireRed Space returned no valid event identifier.");
    return { event_id: result.event_id, session_hash: sessionHash };
  }

  async function getResult(eventHandle, { signal } = {}) {
    const handle = resolveHandle(eventHandle);
    assert(/^[a-zA-Z0-9_-]{8,128}$/.test(handle.event_id), "INVALID_EVENT_ID", "FireRed event identifier is invalid.");
    assert(/^[a-zA-Z0-9_-]{8,128}$/.test(handle.session_hash), "INVALID_SESSION_HASH", "FireRed session hash is invalid.");
    let response;
    try {
      const url = new URL("/gradio_api/queue/data", origin);
      url.searchParams.set("session_hash", handle.session_hash);
      response = await fetchImpl(url.toString(), {
        headers: { accept: "text/event-stream" },
        signal,
        redirect: "error"
      });
    } catch {
      throw fail("RESULT_FETCH_FAILED", "FireRed queue stream could not be reached.");
    }
    assert(response.ok, "RESULT_FETCH_FAILED", "FireRed queue stream returned an error.");
    const output = await readQueueCompletion(response, handle.event_id, { signal, debugUpstreamErrors });
    const data = output?.data;
    assert(Array.isArray(data) && data.length >= 1, "INVALID_UPSTREAM_RESPONSE", "FireRed completion did not include result data.");
    const imageData = data[0];
    const seed = Number.isInteger(data[1]) ? data[1] : null;
    const imageUrl = resolveImageUrl(imageData, origin);

    let imageResponse;
    try {
      imageResponse = await fetchImpl(imageUrl, {
        headers: { accept: "image/png,image/jpeg,image/webp" },
        signal,
        redirect: "error"
      });
    } catch {
      throw fail("OUTPUT_FETCH_FAILED", "FireRed output image could not be downloaded.");
    }
    assert(imageResponse.ok, "OUTPUT_FETCH_FAILED", "FireRed output image returned an error.");
    const mimeType = (imageResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    validateImageBytes(bytes, mimeType, maxOutputBytes);
    return { bytes, mimeType, seed };
  }

  return Object.freeze({ submit, getResult, origin });
}

export { DEFAULT_SPACE_ORIGIN, DEFAULT_INFER_FN_INDEX };
