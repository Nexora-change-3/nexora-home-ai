const ALLOWED_STATUSES = new Set(["planned", "ready", "disabled"]);
const VALID_RENDER_STATUSES = new Set(["succeeded", "failed", "rejected"]);

function registryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateDescriptor(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw registryError("INVALID_ADAPTER", "Adapter must be an object.");
  }
  for (const field of ["id", "provider", "modelId", "status"]) {
    if (typeof adapter[field] !== "string" || !adapter[field].trim()) {
      throw registryError("INVALID_ADAPTER", `Adapter ${field} is required.`);
    }
  }
  if (!ALLOWED_STATUSES.has(adapter.status)) {
    throw registryError("INVALID_ADAPTER_STATUS", `Unsupported adapter status: ${adapter.status}`);
  }
  if (!Array.isArray(adapter.capabilities) ||
      adapter.capabilities.some((item) => typeof item !== "string" || !item.trim())) {
    throw registryError("INVALID_ADAPTER", "Adapter capabilities must be an array of non-empty strings.");
  }
  if (adapter.status === "ready" && typeof adapter.render !== "function") {
    throw registryError("INVALID_ADAPTER", "A ready adapter must provide render(request).");
  }
}

function publicDescriptor(adapter) {
  return {
    id: adapter.id,
    provider: adapter.provider,
    modelId: adapter.modelId,
    status: adapter.status,
    capabilities: [...adapter.capabilities],
    ...(adapter.runtime ? { runtime: adapter.runtime } : {}),
    ...(adapter.notes ? { notes: adapter.notes } : {})
  };
}

export function createAdapterRegistry({ adapters = [] } = {}) {
  const entries = new Map();

  function register(adapter) {
    validateDescriptor(adapter);
    if (entries.has(adapter.id)) {
      throw registryError("DUPLICATE_ADAPTER", `Adapter already registered: ${adapter.id}`);
    }
    entries.set(adapter.id, Object.freeze({
      ...adapter,
      capabilities: Object.freeze([...adapter.capabilities])
    }));
    return publicDescriptor(adapter);
  }

  function list({ includeUnavailable = true } = {}) {
    return [...entries.values()]
      .filter((adapter) => includeUnavailable || adapter.status === "ready")
      .map(publicDescriptor);
  }

  function resolve({ id, requiredCapabilities = [] } = {}) {
    const adapter = entries.get(id);
    if (!adapter) {
      throw registryError("ADAPTER_NOT_FOUND", `Unknown adapter: ${id}`);
    }
    if (adapter.status !== "ready") {
      throw registryError("ADAPTER_NOT_READY", `Adapter is not ready: ${id} (${adapter.status})`);
    }
    const missing = requiredCapabilities.filter((capability) =>
      !adapter.capabilities.includes(capability)
    );
    if (missing.length) {
      throw registryError("CAPABILITY_UNSUPPORTED", `Adapter ${id} lacks: ${missing.join(", ")}`);
    }
    return adapter;
  }

  async function render({ id, request, requiredCapabilities = [] } = {}) {
    const adapter = resolve({ id, requiredCapabilities });
    if (!request || typeof request !== "object") {
      throw registryError("INVALID_RENDER_REQUEST", "A render request object is required.");
    }
    for (const field of ["request_id", "source_image_ref", "design_brief", "safety_policy"]) {
      if (request[field] === undefined || request[field] === null) {
        throw registryError("INVALID_RENDER_REQUEST", `Render request is missing ${field}.`);
      }
    }
    const result = await adapter.render(request);
    if (!result || result.request_id !== request.request_id ||
        !VALID_RENDER_STATUSES.has(result.status)) {
      throw registryError("INVALID_RENDER_RESPONSE", "Adapter returned an invalid render response.");
    }
    return result;
  }

  for (const adapter of adapters) register(adapter);

  return Object.freeze({ register, list, resolve, render });
}
