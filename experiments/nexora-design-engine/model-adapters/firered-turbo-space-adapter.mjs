import { createMemoryDispatchStore } from "./dispatch-ledger.mjs";

const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MODEL_ID = "FireRedTeam/FireRed-Image-Edit-1.1 + Rapid-AIO-V23 transformer";
const MODEL_REVISION = "FireRedTeam/FireRed-Image-Edit-1.1@3bc3f2a12722fd9883eb6357500de191d56baaf5;prithivMLmods/Qwen-Image-Edit-Rapid-AIO-V23@11b8c8c31ded785239679a73dd93c194cf21b1f1";
const SPACE_REVISION = "someone-in-the-world/FireRed-Experimental-Turbo@91b831cc23f0ee770fc2d9c80a4619339a245275";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assert(condition, code, message) {
  if (!condition) throw fail(code, message);
}

function validateRequest(request, maxImageBytes) {
  assert(request && typeof request === "object", "INVALID_REQUEST", "A render request is required.");
  for (const field of ["request_id", "source_image_ref", "source_image", "design_brief", "safety_policy"]) {
    assert(request[field] !== undefined && request[field] !== null, "INVALID_REQUEST", `Missing required field: ${field}.`);
  }
  assert(typeof request.request_id === "string" && request.request_id.trim(), "INVALID_REQUEST", "request_id must be a non-empty string.");
  assert(typeof request.source_image_ref === "string" && request.source_image_ref.trim(), "INVALID_REQUEST", "source_image_ref must be a non-empty string.");
  const consent = request.safety_policy.external_image_processing_consent === true &&
    request.safety_policy.external_provider === "huggingface-zero-gpu";
  assert(consent, "EXTERNAL_PROCESSING_CONSENT_REQUIRED",
    "This provider sends the source image to a public Hugging Face Space. Explicit provider-specific consent is required.");
  const source = request.source_image;
  assert(source.bytes, "SOURCE_IMAGE_UNAVAILABLE", "Backend-resolved source image bytes are required.");
  const bytes = source.bytes instanceof Uint8Array ? source.bytes : new Uint8Array(source.bytes);
  assert(bytes.byteLength > 0 && bytes.byteLength <= maxImageBytes, "INVALID_IMAGE_SIZE",
    "Source image is empty or exceeds the configured size limit.");
  assert(ALLOWED_MIME_TYPES.has(source.mime_type), "UNSUPPORTED_IMAGE_TYPE",
    "Only JPEG, PNG and WebP source images are accepted.");
  const prompt = request.design_brief.render_instructions || request.design_brief.prompt;
  assert(typeof prompt === "string" && prompt.trim() && prompt.length <= 12000,
    "INVALID_PROMPT", "A non-empty render instruction of at most 12000 characters is required.");
  return { bytes, mimeType: source.mime_type, prompt };
}

function createDeadline({ timeoutMs, signal }) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal.reason || fail("CANCELLED", "Render was cancelled."));
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(fail("RENDER_TIMEOUT", "FireRed render timed out.")), timeoutMs);
  return {
    signal: controller.signal,
    close() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortFromParent);
    }
  };
}

async function computeFingerprint(cryptoImpl) {
  assert(cryptoImpl?.subtle?.digest, "CRYPTO_UNAVAILABLE", "SHA-256 support is required for model provenance.");
  const material = JSON.stringify({
    adapter: "firered-turbo-space",
    model: MODEL_ID,
    model_revision: MODEL_REVISION,
    space_revision: SPACE_REVISION,
    mode: "fast",
    steps: 3,
    gpu_duration: 120
  });
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return "sha256:" + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createFireRedTurboSpaceAdapter({
  transport,
  dispatchStore = createMemoryDispatchStore(),
  storeResult,
  maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
  timeoutMs = 150000,
  now = () => Date.now(),
  cryptoImpl = globalThis.crypto,
  status = "planned"
} = {}) {
  assert(transport && typeof transport.submit === "function" && typeof transport.getResult === "function",
    "INVALID_TRANSPORT", "FireRed Turbo transport must implement submit and getResult.");
  assert(dispatchStore && ["get", "claim", "markUnknown", "markQueued", "markSucceeded", "claimRecovery", "releaseRecovery"]
    .every((key) => typeof dispatchStore[key] === "function"),
  "INVALID_DISPATCH_STORE", "Dispatch store must implement durable dispatch and recovery lease operations.");
  assert(typeof storeResult === "function", "INVALID_RESULT_STORE", "An immutable result storage function is required.");
  assert(Number.isInteger(maxImageBytes) && maxImageBytes > 0 && Number.isFinite(timeoutMs) && timeoutMs > 0,
    "INVALID_LIMIT", "Image size and timeout limits are invalid.");
  assert(["planned", "ready", "disabled"].includes(status), "INVALID_ADAPTER_STATUS", "Adapter status is invalid.");

  let fingerprintPromise;
  const inFlight = new Map();
  const completed = new Map();
  const recovering = new Map();
  const getFingerprint = () => fingerprintPromise ||= computeFingerprint(cryptoImpl);

  async function persistResult({ requestId, sourceImageRef, eventId, output, seed, recovered = false, recoveryToken = null }) {
    assert(output && output.bytes && output.bytes.byteLength > 0, "EMPTY_OUTPUT", "FireRed returned an empty image.");
    assert(output.mimeType === "image/png" || output.mimeType === "image/jpeg" || output.mimeType === "image/webp",
      "UNSUPPORTED_OUTPUT_TYPE", "FireRed returned an unsupported image type.");
    const stored = await storeResult({
      requestId,
      bytes: output.bytes instanceof Uint8Array ? output.bytes : new Uint8Array(output.bytes),
      mimeType: output.mimeType,
      metadata: {
        source_image_ref: sourceImageRef,
        provider: "huggingface-zero-gpu",
        model_id: MODEL_ID,
        model_revision: MODEL_REVISION,
        space_revision: SPACE_REVISION,
        event_id: eventId,
        seed,
        recovered
      }
    });
    assert(stored && typeof stored.image_ref === "string" && stored.image_ref,
      "RESULT_STORAGE_FAILED", "NEXORA result storage did not return an immutable image reference.");
    assert(stored.image_ref !== sourceImageRef, "SOURCE_OVERWRITE_BLOCKED",
      "A rendered result must be stored as a new image; the original source reference cannot be overwritten.");
    const result = {
      request_id: requestId,
      status: "succeeded",
      image_ref: stored.image_ref,
      provider: "huggingface-zero-gpu",
      model_id: MODEL_ID,
      model_revision: MODEL_REVISION,
      space_revision: SPACE_REVISION,
      event_id: eventId,
      seed: Number.isInteger(seed) ? seed : null,
      recovered
    };
    await dispatchStore.markSucceeded(requestId, result, recoveryToken);
    return result;
  }

  async function render(request) {
    const { bytes, mimeType, prompt } = validateRequest(request, maxImageBytes);
    const requestId = request.request_id;
    if (completed.has(requestId)) return completed.get(requestId);
    assert(!inFlight.has(requestId), "DUPLICATE_REQUEST_IN_PROGRESS", "A render with this request_id is already running.");
    const fingerprint = await getFingerprint();
    const previous = await dispatchStore.get(requestId);
    if (previous) {
      assert(previous.source_image_ref === request.source_image_ref && previous.workflow_hash === fingerprint,
        "REQUEST_ID_CONFLICT", "This request_id is already bound to another source image or model revision.");
      if (previous.state === "succeeded" && previous.result) return previous.result;
      throw fail("DUPLICATE_SUBMISSION_BLOCKED",
        "This request_id already has a dispatch record. Reconcile the existing event; do not submit it again.");
    }

    const operation = runRender({ request, bytes, mimeType, prompt, fingerprint });
    inFlight.set(requestId, operation);
    try {
      const result = await operation;
      completed.set(requestId, result);
      return result;
    } finally {
      inFlight.delete(requestId);
    }
  }

  async function runRender({ request, bytes, mimeType, prompt, fingerprint }) {
    const requestId = request.request_id;
    const startedAt = now();
    const claimed = await dispatchStore.claim({
      requestId,
      sourceImageRef: request.source_image_ref,
      workflowHash: fingerprint
    });
    assert(claimed, "DUPLICATE_SUBMISSION_BLOCKED", "This request_id already has a dispatch record.");
    const deadline = createDeadline({ timeoutMs, signal: request.signal });
    let submission;
    try {
      submission = await transport.submit({
        imageBytes: bytes,
        mimeType,
        prompt,
        seed: Number.isInteger(request.seed) ? request.seed : 42,
        randomizeSeed: false,
        steps: 3,
        mode: "fast",
        gpuDuration: 120,
        signal: deadline.signal
      });
    } catch {
      await dispatchStore.markUnknown(requestId).catch(() => {});
      deadline.close();
      throw fail("QUEUE_OUTCOME_UNKNOWN",
        "FireRed queue submission was not confirmed. The request is blocked from resubmission to prevent duplicate generation.");
    }
    assert(submission && typeof submission.event_id === "string" && submission.event_id,
      "QUEUE_OUTCOME_UNKNOWN", "FireRed returned no event identifier; the request must not be resubmitted.");
    await dispatchStore.markQueued(requestId, submission.event_id);

    try {
      const output = await transport.getResult(submission.event_id, { signal: deadline.signal });
      const result = await persistResult({
        requestId,
        sourceImageRef: request.source_image_ref,
        eventId: submission.event_id,
        output,
        seed: output.seed,
        recovered: false
      });
      return { ...result, elapsed_ms: Math.max(0, now() - startedAt) };
    } finally {
      deadline.close();
    }
  }

  async function recover(requestId, { signal } = {}) {
    assert(typeof requestId === "string" && requestId.trim(), "INVALID_REQUEST", "A request_id is required for recovery.");
    if (completed.has(requestId)) return completed.get(requestId);
    if (recovering.has(requestId)) return recovering.get(requestId);
    const operation = recoverQueued(requestId, signal);
    recovering.set(requestId, operation);
    try {
      const result = await operation;
      if (result?.status === "succeeded") completed.set(requestId, result);
      return result;
    } finally {
      recovering.delete(requestId);
    }
  }

  async function recoverQueued(requestId, signal) {
    const fingerprint = await getFingerprint();
    const record = await dispatchStore.get(requestId);
    assert(record, "DISPATCH_RECORD_NOT_FOUND", "No dispatch record exists for this request_id.");
    assert(record.workflow_hash === fingerprint, "REQUEST_ID_CONFLICT", "Saved dispatch belongs to a different model revision.");
    if (record.state === "succeeded" && record.result) return record.result;
    assert(record.state === "queued" && typeof record.prompt_id === "string" && record.prompt_id,
      "DISPATCH_NOT_RECOVERABLE", "Only a confirmed queued FireRed event can be recovered; unknown submissions are never retried.");

    const recoveryToken = cryptoImpl?.randomUUID?.();
    assert(typeof recoveryToken === "string" && recoveryToken, "RECOVERY_LOCK_UNAVAILABLE", "A secure recovery lease token is required.");
    const leaseNow = new Date(now()).toISOString();
    const leaseUntil = new Date(now() + timeoutMs * 2).toISOString();
    const claimed = await dispatchStore.claimRecovery({ requestId, recoveryToken, leaseUntil, now: leaseNow });
    assert(claimed, "RECOVERY_ALREADY_CLAIMED", "Another process is already recovering this FireRed event.");

    let succeeded = false;
    const deadline = createDeadline({ timeoutMs, signal });
    try {
      const output = await transport.getResult(record.prompt_id, { signal: deadline.signal });
      const result = await persistResult({
        requestId,
        sourceImageRef: record.source_image_ref,
        eventId: record.prompt_id,
        output,
        seed: output.seed,
        recovered: true,
        recoveryToken
      });
      succeeded = true;
      return result;
    } finally {
      deadline.close();
      if (!succeeded) await dispatchStore.releaseRecovery(requestId, recoveryToken).catch(() => {});
    }
  }

  return Object.freeze({
    id: "huggingface-zero-gpu-firered-turbo",
    provider: "huggingface-zero-gpu",
    modelId: MODEL_ID,
    status,
    runtime: "public-zero-gpu",
    notes: "Experimental public Space; external image-processing consent is required. Not approved for private user photos until consent and retention are confirmed.",
    capabilities: Object.freeze(["image-edit", "instruction-following", "source-image-preservation"]),
    render,
    recover
  });
}

export { MODEL_ID, MODEL_REVISION, SPACE_REVISION };
