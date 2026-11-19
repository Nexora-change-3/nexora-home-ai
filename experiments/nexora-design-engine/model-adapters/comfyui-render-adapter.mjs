const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}

function clone(value) {
  return structuredClone(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function digestWorkflow(workflow, cryptoImpl) {
  assert(cryptoImpl?.subtle && typeof cryptoImpl.subtle.digest === "function", "CRYPTO_UNAVAILABLE", "Web Crypto SHA-256 is required to verify the pinned workflow.");
  const bytes = new TextEncoder().encode(stableStringify(workflow));
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function validateRequest(request, maxImageBytes) {
  assert(request && typeof request === "object", "INVALID_REQUEST", "Render request is required.");
  for (const field of ["request_id", "source_image_ref", "design_brief", "safety_policy"]) {
    assert(request[field] !== undefined && request[field] !== null, "INVALID_REQUEST", `Missing required field: ${field}.`);
  }
  assert(typeof request.request_id === "string" && request.request_id.trim(), "INVALID_REQUEST", "request_id must be a non-empty string.");
  assert(request.source_image && request.source_image.bytes, "SOURCE_IMAGE_UNAVAILABLE", "Backend-resolved source image bytes are required.");
  const bytes = request.source_image.bytes instanceof Uint8Array ? request.source_image.bytes : new Uint8Array(request.source_image.bytes);
  assert(bytes.byteLength > 0 && bytes.byteLength <= maxImageBytes, "INVALID_IMAGE_SIZE", "Source image is empty or exceeds the configured size limit.");
  const mimeType = request.source_image.mime_type;
  assert(ALLOWED_MIME_TYPES.has(mimeType), "UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG and WebP source images are accepted.");
  return { bytes, mimeType };
}

function applyNodeInput(workflow, mapping, value, required = true) {
  if (!mapping) {
    assert(!required, "INVALID_WORKFLOW_MAPPING", "A required workflow node mapping is missing.");
    return;
  }
  const node = workflow[mapping.node_id];
  assert(node && node.inputs && typeof node.inputs === "object", "INVALID_WORKFLOW_MAPPING", `Workflow node ${mapping.node_id} is missing.`);
  assert(Object.hasOwn(node.inputs, mapping.input_name), "INVALID_WORKFLOW_MAPPING", `Workflow input ${mapping.node_id}.${mapping.input_name} is missing.`);
  node.inputs[mapping.input_name] = value;
}

function findOutputImage(historyEntry, outputNodeId) {
  const outputs = historyEntry?.outputs;
  const nodeOutput = outputNodeId ? outputs?.[outputNodeId] : Object.values(outputs || {}).find((item) => Array.isArray(item?.images) && item.images.length);
  const image = nodeOutput?.images?.[0];
  assert(image && typeof image.filename === "string" && image.filename, "OUTPUT_NOT_FOUND", "ComfyUI completed without a configured output image.");
  return { filename: image.filename, subfolder: typeof image.subfolder === "string" ? image.subfolder : "", type: typeof image.type === "string" ? image.type : "output" };
}

function createOperationContext({ timeoutMs, signal, now, onAbort }) {
  const controller = new AbortController();
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  aborted.catch(() => {});
  const abort = (error) => {
    if (!controller.signal.aborted) controller.abort(error);
    rejectAbort(error);
    try { Promise.resolve(onAbort?.(error)).catch(() => {}); } catch {}
  };
  const timer = setTimeout(() => abort(fail("RENDER_TIMEOUT", "ComfyUI render exceeded the configured timeout.")), timeoutMs);
  const handleAbort = () => abort(fail("CANCELLED", "Render was cancelled."));
  if (signal?.aborted) handleAbort();
  else signal?.addEventListener("abort", handleAbort, { once: true });
  return {
    signal: controller.signal,
    deadline: now() + timeoutMs,
    async run(operation) {
      if (controller.signal.aborted) throw controller.signal.reason || fail("CANCELLED", "Render was cancelled.");
      return Promise.race([Promise.resolve().then(() => operation(controller.signal)), aborted]);
    },
    close() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
    }
  };
}

export function createComfyUiRenderAdapter({
  transport, workflow, nodeInputs, outputNodeId, modelId, modelRevision, workflowHash,
  maxImageBytes = DEFAULT_MAX_IMAGE_BYTES, timeoutMs = 10 * 60 * 1000, pollIntervalMs = 1000,
  now = () => Date.now(), cryptoImpl = globalThis.crypto,
  sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || fail("CANCELLED", "Render was cancelled."));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason || fail("CANCELLED", "Render was cancelled.")); }, { once: true });
  })
} = {}) {
  assert(transport && ["uploadImage", "queuePrompt", "getHistory", "getOutput", "storeResult"].every((key) => typeof transport[key] === "function"), "INVALID_TRANSPORT", "ComfyUI transport must implement uploadImage, queuePrompt, getHistory, getOutput and storeResult.");
  assert(workflow && typeof workflow === "object" && !Array.isArray(workflow), "INVALID_WORKFLOW", "A pinned API-format workflow object is required.");
  assert(nodeInputs?.image && nodeInputs?.prompt, "INVALID_WORKFLOW_MAPPING", "Image and prompt node mappings are required.");
  assert(typeof modelId === "string" && modelId && typeof workflowHash === "string" && /^sha256:[a-f0-9]{64}$/.test(workflowHash), "INVALID_PROVENANCE", "Model ID and a full SHA-256 workflow hash are required.");
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0 && Number.isFinite(pollIntervalMs) && pollIntervalMs >= 0, "INVALID_TIMING", "Timeout and polling interval are invalid.");

  const pinnedWorkflow = clone(workflow);
  const inFlight = new Map();
  const completed = new Map();

  async function render(request) {
    validateRequest(request, maxImageBytes);
    const requestId = request.request_id;
    if (completed.has(requestId)) return completed.get(requestId);
    assert(!inFlight.has(requestId), "DUPLICATE_REQUEST_IN_PROGRESS", "A render with this request_id is already running.");
    const operation = runRender(request);
    inFlight.set(requestId, operation);
    try {
      const result = await operation;
      completed.set(requestId, result);
      return result;
    } finally {
      inFlight.delete(requestId);
    }
  }

  async function runRender(request) {
    const startedAt = now();
    let activePromptId = null;
    const context = createOperationContext({
      timeoutMs, signal: request.signal, now,
      onAbort: () => activePromptId ? transport.cancelPrompt?.(activePromptId) : undefined
    });
    const { bytes, mimeType } = validateRequest(request, maxImageBytes);
    const checkActive = () => {
      if (context.signal.aborted) throw context.signal.reason || fail("CANCELLED", "Render was cancelled.");
      if (now() >= context.deadline) throw fail("RENDER_TIMEOUT", "ComfyUI render exceeded the configured timeout.");
    };

    try {
      checkActive();
      const actualHash = await context.run(() => digestWorkflow(pinnedWorkflow, cryptoImpl));
      assert(actualHash === workflowHash, "WORKFLOW_HASH_MISMATCH", "The pinned ComfyUI workflow does not match its configured SHA-256 hash.");
      checkActive();

      const uploaded = await context.run((signal) => transport.uploadImage({ bytes: new Uint8Array(bytes), mimeType, filename: `nexora-source-${request.request_id}`, signal }));
      assert(uploaded && typeof uploaded.name === "string" && uploaded.name, "UPLOAD_FAILED", "ComfyUI did not return a server-side image name.");

      const apiWorkflow = clone(pinnedWorkflow);
      applyNodeInput(apiWorkflow, nodeInputs.image, uploaded.name);
      applyNodeInput(apiWorkflow, nodeInputs.prompt, request.design_brief.render_instructions || request.design_brief.prompt);
      if (nodeInputs.seed && request.seed !== undefined && request.seed !== null) applyNodeInput(apiWorkflow, nodeInputs.seed, request.seed, false);
      checkActive();

      const queued = await context.run((signal) => transport.queuePrompt({ workflow: apiWorkflow, clientId: request.request_id, signal }));
      assert(queued && typeof queued.prompt_id === "string" && queued.prompt_id, "QUEUE_FAILED", "ComfyUI did not acknowledge the render job.");
      activePromptId = queued.prompt_id;
      if (context.signal.aborted) {
        await transport.cancelPrompt?.(activePromptId);
        throw context.signal.reason || fail("CANCELLED", "Render was cancelled.");
      }
      let historyEntry;
      while (true) {
        checkActive();
        const history = await context.run((signal) => transport.getHistory(queued.prompt_id, { signal }));
        historyEntry = history?.[queued.prompt_id];
        if (historyEntry?.status?.completed === true) break;
        const statusText = historyEntry?.status?.status_str;
        const hasExecutionError = (historyEntry?.status?.messages || []).some(([kind]) => kind === "execution_error");
        if (statusText === "error" || hasExecutionError) throw fail("UPSTREAM_RENDER_FAILED", "ComfyUI reported an execution error.");
        await context.run((signal) => sleep(Math.min(pollIntervalMs, Math.max(0, context.deadline - now())), signal));
      }

      const output = findOutputImage(historyEntry, outputNodeId);
      checkActive();
      const rendered = await context.run((signal) => transport.getOutput(output, { signal }));
      const outputBytes = rendered instanceof Uint8Array ? rendered : new Uint8Array(rendered);
      assert(outputBytes.byteLength > 0, "EMPTY_OUTPUT", "ComfyUI returned an empty output image.");
      const stored = await context.run((signal) => transport.storeResult({
        requestId: request.request_id, bytes: outputBytes, mimeType: "image/png",
        metadata: { source_image_ref: request.source_image_ref, provider: "comfyui", model_id: modelId, model_revision: modelRevision || null, workflow_hash: workflowHash, prompt_id: queued.prompt_id, output },
        signal
      }));
      assert(stored && typeof stored.image_ref === "string" && stored.image_ref, "RESULT_STORAGE_FAILED", "NEXORA result storage did not return an immutable image reference.");
      assert(stored.image_ref !== request.source_image_ref, "SOURCE_OVERWRITE_BLOCKED", "A rendered result must be stored as a new image; the original source reference cannot be overwritten.");
      return {
        request_id: request.request_id, status: "succeeded", image_ref: stored.image_ref,
        model_id: modelId, model_revision: modelRevision || null, workflow_hash: workflowHash,
        prompt_id: queued.prompt_id, elapsed_ms: Math.max(0, now() - startedAt)
      };
    } finally {
      context.close();
    }
  }

  return Object.freeze({
    id: "comfyui-firered-image-edit", provider: "comfyui", modelId, status: "ready",
    capabilities: Object.freeze(["image-edit", "instruction-following", "source-image-preservation"]),
    render
  });
}
