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

function validateRequest(request, maxImageBytes) {
  assert(request && typeof request === "object", "INVALID_REQUEST", "Render request is required.");
  for (const field of ["request_id", "source_image_ref", "design_brief", "safety_policy"]) {
    assert(request[field] !== undefined && request[field] !== null, "INVALID_REQUEST", `Missing required field: ${field}.`);
  }
  assert(typeof request.request_id === "string" && request.request_id.trim(), "INVALID_REQUEST", "request_id must be a non-empty string.");
  assert(request.source_image && request.source_image.bytes, "SOURCE_IMAGE_UNAVAILABLE", "Backend-resolved source image bytes are required.");
  const bytes = request.source_image.bytes instanceof Uint8Array
    ? request.source_image.bytes
    : new Uint8Array(request.source_image.bytes);
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
  node.inputs[mapping.input_name] = value;
}

function findOutputImage(historyEntry, outputNodeId) {
  const outputs = historyEntry?.outputs;
  const nodeOutput = outputNodeId ? outputs?.[outputNodeId] : Object.values(outputs || {}).find((item) => Array.isArray(item?.images) && item.images.length);
  const image = nodeOutput?.images?.[0];
  assert(image && typeof image.filename === "string" && image.filename, "OUTPUT_NOT_FOUND", "ComfyUI completed without a configured output image.");
  return {
    filename: image.filename,
    subfolder: typeof image.subfolder === "string" ? image.subfolder : "",
    type: typeof image.type === "string" ? image.type : "output"
  };
}

function createOperationContext({ timeoutMs, signal, now }) {
  const controller = new AbortController();
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const abort = (error) => {
    if (!controller.signal.aborted) controller.abort(error);
    rejectAbort(error);
  };
  const timer = setTimeout(() => abort(fail("RENDER_TIMEOUT", "ComfyUI render exceeded the configured timeout.")), timeoutMs);
  const onAbort = () => abort(fail("CANCELLED", "Render was cancelled."));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  return {
    signal: controller.signal,
    deadline: now() + timeoutMs,
    async run(operation) {
      if (controller.signal.aborted) throw controller.signal.reason || fail("CANCELLED", "Render was cancelled.");
      return Promise.race([Promise.resolve().then(() => operation(controller.signal)), aborted]);
    },
    close() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  };
}

export function createComfyUiRenderAdapter({
  transport,
  workflow,
  nodeInputs,
  outputNodeId,
  modelId,
  modelRevision,
  workflowHash,
  maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 1000,
  now = () => Date.now(),
  sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || fail("CANCELLED", "Render was cancelled."));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason || fail("CANCELLED", "Render was cancelled."));
    }, { once: true });
  })
} = {}) {
  assert(transport && typeof transport.uploadImage === "function" &&
    typeof transport.queuePrompt === "function" &&
    typeof transport.getHistory === "function" &&
    typeof transport.getOutput === "function" &&
    typeof transport.storeResult === "function", "INVALID_TRANSPORT", "ComfyUI transport must implement uploadImage, queuePrompt, getHistory, getOutput and storeResult.");
  assert(workflow && typeof workflow === "object", "INVALID_WORKFLOW", "A pinned API-format workflow object is required.");
  assert(nodeInputs?.image && nodeInputs?.prompt, "INVALID_WORKFLOW_MAPPING", "Image and prompt node mappings are required.");
  assert(typeof modelId === "string" && modelId && typeof workflowHash === "string" && workflowHash, "INVALID_PROVENANCE", "Model ID and workflow hash are required.");
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0 && Number.isFinite(pollIntervalMs) && pollIntervalMs >= 0, "INVALID_TIMING", "Timeout and polling interval are invalid.");

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
    const context = createOperationContext({ timeoutMs, signal: request.signal, now });
    const { bytes, mimeType } = validateRequest(request, maxImageBytes);
    const checkActive = () => {
      if (context.signal.aborted) throw context.signal.reason || fail("CANCELLED", "Render was cancelled.");
      if (now() >= context.deadline) throw fail("RENDER_TIMEOUT", "ComfyUI render exceeded the configured timeout.");
    };

    try {
      checkActive();
      const uploaded = await context.run((signal) => transport.uploadImage({
        bytes: new Uint8Array(bytes),
        mimeType,
        filename: `nexora-source-${request.request_id}`,
        signal
      }));
      assert(uploaded && typeof uploaded.name === "string" && uploaded.name, "UPLOAD_FAILED", "ComfyUI did not return a server-side image name.");

      const apiWorkflow = clone(workflow);
      applyNodeInput(apiWorkflow, nodeInputs.image, uploaded.name);
      applyNodeInput(apiWorkflow, nodeInputs.prompt, request.design_brief.render_instructions || request.design_brief.prompt);
      if (nodeInputs.seed) applyNodeInput(apiWorkflow, nodeInputs.seed, request.seed, false);
      checkActive();

      const queued = await context.run((signal) => transport.queuePrompt({
        workflow: apiWorkflow,
        clientId: request.request_id,
        signal
      }));
      assert(queued && typeof queued.prompt_id === "string" && queued.prompt_id, "QUEUE_FAILED", "ComfyUI did not acknowledge the render job.");
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
        requestId: request.request_id,
        bytes: outputBytes,
        mimeType: "image/png",
        metadata: {
          source_image_ref: request.source_image_ref,
          provider: "comfyui",
          model_id: modelId,
          model_revision: modelRevision || null,
          workflow_hash: workflowHash,
          prompt_id: queued.prompt_id,
          output
        },
        signal
      }));
      assert(stored && typeof stored.image_ref === "string" && stored.image_ref, "RESULT_STORAGE_FAILED", "NEXORA result storage did not return an immutable image reference.");

      return {
        request_id: request.request_id,
        status: "succeeded",
        image_ref: stored.image_ref,
        model_id: modelId,
        model_revision: modelRevision || null,
        workflow_hash: workflowHash,
        prompt_id: queued.prompt_id,
        elapsed_ms: Math.max(0, now() - startedAt)
      };
    } finally {
      context.close();
    }
  }

  return Object.freeze({
    id: "comfyui-firered-image-edit",
    provider: "comfyui",
    modelId,
    status: "ready",
    capabilities: Object.freeze(["image-edit", "instruction-following", "source-image-preservation"]),
    render
  });
}
