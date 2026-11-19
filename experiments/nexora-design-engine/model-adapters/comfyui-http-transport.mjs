const DEFAULT_MAX_RESPONSE_BYTES = 40 * 1024 * 1024;

function sniffImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

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
      response = await fetchImpl(endpoint(path), { ...options, redirect: "error", headers: { ...headers, ...(options?.headers || {}) } });
    } catch {
      throw fail(code, message);
    }
    return response;
  }

  async function getJson(path, code, message, signal) {
    const response = await request(path, { method: "GET", signal }, code, message);
    return readJson(response, code, message);
  }

  return Object.freeze({
    async getObjectInfo({ signal } = {}) {
      return getJson("/object_info", "RUNTIME_PREFLIGHT_FAILED", "Could not inspect ComfyUI node definitions.", signal);
    },

    async getModels(folder, { signal } = {}) {
      assert(["diffusion_models", "loras", "text_encoders", "vae"].includes(folder), "INVALID_MODEL_FOLDER", "The requested ComfyUI model folder is not allowed.");
      return getJson(`/models/${folder}`, "RUNTIME_PREFLIGHT_FAILED", "Could not inspect ComfyUI model inventory.", signal);
    },

    async getSystemStats({ signal } = {}) {
      return getJson("/system_stats", "RUNTIME_PREFLIGHT_FAILED", "Could not inspect ComfyUI runtime information.", signal);
    },

    async uploadImage({ bytes, mimeType, filename, signal }) {
      assert(bytes instanceof Uint8Array && bytes.byteLength > 0, "INVALID_IMAGE", "A non-empty image is required for upload.");
      assert(["image/jpeg", "image/png", "image/webp"].includes(mimeType), "UNSUPPORTED_IMAGE_TYPE", "The source image type is not supported.");
      assert(sniffImageMime(bytes) === mimeType, "INVALID_IMAGE_SIGNATURE", "The source image bytes do not match the declared MIME type.");
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

    async cancelPrompt(promptId, { signal } = {}) {
      assert(typeof promptId === "string" && /^[a-zA-Z0-9_-]+$/.test(promptId), "INVALID_PROMPT_ID", "The ComfyUI prompt ID is invalid.");
      const post = async (path, body) => {
        const response = await request(path, {
          method: "POST", signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }, "CANCEL_FAILED", "ComfyUI could not cancel the render job.");
        if (!response.ok) throw fail("CANCEL_FAILED", "ComfyUI could not cancel the render job.");
      };
      await Promise.all([
        post("/queue", { delete: [promptId] }),
        post("/interrupt", { prompt_id: promptId })
      ]);
      return { requested: true, prompt_id: promptId };
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
      const contentType = response.headers?.get?.("content-type");
      assert(!contentType || /^image\/png(?:\s*;|\s*$)/i.test(contentType), "INVALID_OUTPUT_MIME", "The FireRed workflow must return a PNG image.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert(bytes.byteLength > 0 && bytes.byteLength <= maxResponseBytes, "INVALID_OUTPUT", "ComfyUI returned an empty or oversized output image.");
      assert(sniffImageMime(bytes) === "image/png", "INVALID_OUTPUT_SIGNATURE", "ComfyUI output bytes are not a valid PNG signature.");
      return bytes;
    },

    async storeResult(input) {
      return storeResult(input);
    }
  });
}
