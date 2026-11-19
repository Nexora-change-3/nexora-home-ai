const DEFAULT_MAX_RESPONSE_BYTES = 40 * 1024 * 1024;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}

function parseBaseUrl(value, allowedOrigins) {
  assert(typeof value === "string" && value.trim(), "INVALID_CONFIG", "A ComfyUI base URL is required.");
  let url;
  try { url = new URL(value); } catch { throw fail("INVALID_CONFIG", "The ComfyUI base URL is invalid."); }
  assert(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)), "INVALID_CONFIG", "ComfyUI must use HTTPS except for local development.");
  assert(!url.username && !url.password && !url.search && !url.hash, "INVALID_CONFIG", "The ComfyUI base URL must not contain credentials, query parameters or fragments.");
  assert(Array.isArray(allowedOrigins) && allowedOrigins.includes(url.origin), "ORIGIN_NOT_ALLOWED", "The ComfyUI origin is not in the server-side allowlist.");
  return url.origin;
}

function safeSegment(value, field) {
  assert(typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && !/[\\/\\\\\0]/.test(value), "INVALID_OUTPUT_REFERENCE", `ComfyUI returned an invalid ${field}.`);
  return value;
}

async function readJson(response, code, message) {
  if (!response.ok) throw fail(code, message);
  try { return await response.json(); } catch { throw fail("INVALID_UPSTREAM_RESPONSE", "ComfyUI returned an invalid JSON response."); }
}

export function createComfyUiHttpTransport({
  baseUrl,
  allowedOrigins,
  authToken,
  fetchImpl = globalThis.fetch,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  storeResult
} = {}) {
  const origin = parseBaseUrl(baseUrl, allowedOrigins);
  assert(typeof authToken === "string" && authToken.trim(), "INVALID_CONFIG", "A server-side ComfyUI authentication token is required.");
  assert(typeof fetchImpl === "function", "INVALID_CONFIG", "A Fetch-compatible transport is required.");
  assert(typeof storeResult === "function", "INVALID_CONFIG", "An immutable NEXORA result-storage function is required.");
  assert(Number.isSafeInteger(maxResponseBytes) && maxResponseBytes > 0, "INVALID_CONFIG", "The output size limit is invalid.");

  const headers = Object.freeze({ Authorization: `Bearer ${authToken}` });
  const endpoint = (path) => new URL(path, `${origin}/`).toString();

  async function request(path, options, code, message) {
    let response;
    try {
      response = await fetchImpl(endpoint(path), { ...options, headers: { ...headers, ...(options?.headers || {}) } });
    } catch {
      throw fail(code, message);
    }
    return response;
  }

  return Object.freeze({
    async uploadImage({ bytes, mimeType, filename, signal }) {
      assert(bytes instanceof Uint8Array && bytes.byteLength > 0, "INVALID_IMAGE", "A non-empty image is required for upload.");
      assert(["image/jpeg", "image/png", "image/webp"].includes(mimeType), "UNSUPPORTED_IMAGE_TYPE", "The source image type is not supported.");
      const safeName = String(filename || "nexora-source").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
      const form = new FormData();
      form.append("image", new Blob([bytes], { type: mimeType }), `${safeName}.${extension}`);
      form.append("type", "input");
      form.append("overwrite", "false");
      const response = await request("/upload/image", { method: "POST", body: form, signal }, "UPLOAD_FAILED", "ComfyUI image upload failed.");
      const result = await readJson(response, "UPLOAD_FAILED", "ComfyUI image upload failed.");
      assert(typeof result.name === "string" && result.name, "UPLOAD_FAILED", "ComfyUI did not return an uploaded image name.");
      return { name: result.name, subfolder: result.subfolder || "", type: result.type || "input" };
    },

    async queuePrompt({ workflow, clientId, signal }) {
      assert(workflow && typeof workflow === "object" && !Array.isArray(workflow), "INVALID_WORKFLOW", "A ComfyUI API workflow is required.");
      const response = await request("/prompt", {
        method: "POST", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow, client_id: clientId })
      }, "QUEUE_FAILED", "ComfyUI could not queue the render.");
      const result = await readJson(response, "QUEUE_FAILED", "ComfyUI could not queue the render.");
      assert(typeof result.prompt_id === "string" && result.prompt_id, "QUEUE_FAILED", "ComfyUI did not return a prompt ID.");
      return { prompt_id: result.prompt_id };
    },

    async getHistory(promptId, { signal } = {}) {
      assert(typeof promptId === "string" && /^[a-zA-Z0-9_-]+$/.test(promptId), "INVALID_PROMPT_ID", "The ComfyUI prompt ID is invalid.");
      const response = await request(`/history/${encodeURIComponent(promptId)}`, { method: "GET", signal }, "HISTORY_FAILED", "Could not read ComfyUI render status.");
      return readJson(response, "HISTORY_FAILED", "Could not read ComfyUI render status.");
    },

    async getOutput(output, { signal } = {}) {
      assert(output && typeof output === "object", "INVALID_OUTPUT_REFERENCE", "A ComfyUI output reference is required.");
      const filename = safeSegment(output.filename, "filename");
      const subfolder = output.subfolder ? String(output.subfolder).split("/").map((part) => safeSegment(part, "subfolder")).join("/") : "";
      const type = safeSegment(output.type || "output", "output type");
      const params = new URLSearchParams({ filename, subfolder, type });
      const response = await request(`/view?${params.toString()}`, { method: "GET", signal }, "OUTPUT_FETCH_FAILED", "Could not retrieve the ComfyUI output image.");
      if (!response.ok) throw fail("OUTPUT_FETCH_FAILED", "Could not retrieve the ComfyUI output image.");
      const declaredLength = Number(response.headers?.get?.("content-length") || 0);
      assert(!declaredLength || declaredLength <= maxResponseBytes, "OUTPUT_TOO_LARGE", "The rendered image exceeds the configured size limit.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert(bytes.byteLength > 0 && bytes.byteLength <= maxResponseBytes, "INVALID_OUTPUT", "ComfyUI returned an empty or oversized output image.");
      return bytes;
    },

    async storeResult(input) {
      return storeResult(input);
    }
  });
}
