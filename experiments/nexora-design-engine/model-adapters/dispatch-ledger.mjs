function assert(condition, code, message) {
  if (condition) return;
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function createMemoryDispatchStore() {
  const records = new Map();
  return Object.freeze({
    async get(requestId) { return records.get(requestId) || null; },
    async claimRecovery({ requestId, recoveryToken, leaseUntil, now: timestamp }) {
      const row = records.get(requestId);
      if (!row || row.state !== "queued") return false;
      if (row.recovery_token && row.recovery_lease_until > timestamp) return false;
      row.recovery_token = recoveryToken;
      row.recovery_lease_until = leaseUntil;
      return true;
    },
    async releaseRecovery(requestId, recoveryToken) {
      const row = records.get(requestId);
      if (!row || row.recovery_token !== recoveryToken) return false;
      row.recovery_token = null;
      row.recovery_lease_until = null;
      return true;
    },
    async claim({ requestId, sourceImageRef, workflowHash }) {
      if (records.has(requestId)) return false;
      records.set(requestId, { request_id: requestId, source_image_ref: sourceImageRef, workflow_hash: workflowHash, state: "submitting", prompt_id: null, result: null, recovery_token: null, recovery_lease_until: null });
      return true;
    },
    async claimRecovery({ requestId, recoveryToken, leaseUntil, now: timestamp }) {
      const sql = "UPDATE " + table + " SET recovery_token = ?, recovery_lease_until = ?, updated_at = ? WHERE request_id = ? AND state = 'queued' AND (recovery_token IS NULL OR recovery_lease_until <= ?)";
      const result = await db.prepare(sql).bind(recoveryToken, leaseUntil, timestamp, requestId, timestamp).run();
      return Number(result && result.meta && result.meta.changes || 0) === 1;
    },
    async releaseRecovery(requestId, recoveryToken) {
      const sql = "UPDATE " + table + " SET recovery_token = NULL, recovery_lease_until = NULL, updated_at = ? WHERE request_id = ? AND recovery_token = ?";
      const result = await db.prepare(sql).bind(now(), requestId, recoveryToken).run();
      return Number(result && result.meta && result.meta.changes || 0) === 1;
    },
    async markUnknown(requestId) {
      const row = records.get(requestId);
      assert(row, "DISPATCH_RECORD_NOT_FOUND", "Dispatch record does not exist.");
      row.state = "outcome_unknown";
    },
    async markQueued(requestId, promptId) {
      const row = records.get(requestId);
      assert(row, "DISPATCH_RECORD_NOT_FOUND", "Dispatch record does not exist.");
      row.state = "queued";
      row.prompt_id = promptId;
    },
    async markSucceeded(requestId, result, recoveryToken = null) {
      const row = records.get(requestId);
      assert(row, "DISPATCH_RECORD_NOT_FOUND", "Dispatch record does not exist.");
      assert(row.state === "queued" && (recoveryToken ? row.recovery_token === recoveryToken : !row.recovery_token), "DISPATCH_STATE_CONFLICT", "Dispatch result cannot be committed without owning the recovery lease.");
      row.state = "succeeded";
      row.result = structuredClone(result);
      row.recovery_token = null;
      row.recovery_lease_until = null;
    }
  });
}

function parseRow(row) {
  if (!row) return null;
  let result = null;
  if (row.result_json) {
    try { result = JSON.parse(row.result_json); }
    catch { throw Object.assign(new Error("Dispatch ledger contains invalid result JSON."), { code: "DISPATCH_LEDGER_CORRUPT" }); }
  }
  return { request_id: row.request_id, source_image_ref: row.source_image_ref, workflow_hash: row.workflow_hash, state: row.state, prompt_id: row.prompt_id || null, result, recovery_token: row.recovery_token || null, recovery_lease_until: row.recovery_lease_until || null };
}

export function createD1DispatchStore(db, options = {}) {
  const tableName = options.tableName || "nexora_render_dispatches";
  const now = options.now || (() => new Date().toISOString());
  assert(db && typeof db.prepare === "function", "INVALID_D1_BINDING", "A Cloudflare D1 database binding is required.");
  assert(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName), "INVALID_TABLE_NAME", "Dispatch table name is invalid.");
  const table = '"' + tableName + '"';
  async function get(requestId) {
    const sql = "SELECT request_id, source_image_ref, workflow_hash, state, prompt_id, result_json, recovery_token, recovery_lease_until FROM " + table + " WHERE request_id = ? LIMIT 1";
    const row = await db.prepare(sql).bind(requestId).first();
    return parseRow(row);
  }
  return Object.freeze({
    get,
    async claim({ requestId, sourceImageRef, workflowHash }) {
      const timestamp = now();
      const sql = "INSERT OR IGNORE INTO " + table + " (request_id, source_image_ref, workflow_hash, state, prompt_id, result_json, created_at, updated_at) VALUES (?, ?, ?, 'submitting', NULL, NULL, ?, ?)";
      const result = await db.prepare(sql).bind(requestId, sourceImageRef, workflowHash, timestamp, timestamp).run();
      return Number(result && result.meta && result.meta.changes || 0) === 1;
    },
    async markUnknown(requestId) {
      const sql = "UPDATE " + table + " SET state = 'outcome_unknown', updated_at = ? WHERE request_id = ? AND state = 'submitting'";
      const result = await db.prepare(sql).bind(now(), requestId).run();
      assert(Number(result && result.meta && result.meta.changes || 0) === 1, "DISPATCH_STATE_CONFLICT", "Dispatch record could not be marked outcome_unknown.");
    },
    async markQueued(requestId, promptId) {
      const sql = "UPDATE " + table + " SET state = 'queued', prompt_id = ?, updated_at = ? WHERE request_id = ? AND state IN ('submitting', 'outcome_unknown')";
      const result = await db.prepare(sql).bind(promptId, now(), requestId).run();
      assert(Number(result && result.meta && result.meta.changes || 0) === 1, "DISPATCH_STATE_CONFLICT", "Dispatch record could not be marked queued.");
    },
    async markSucceeded(requestId, resultValue, recoveryToken = null) {
      const predicate = recoveryToken ? " AND recovery_token = ?" : " AND recovery_token IS NULL";
      const sql = "UPDATE " + table + " SET state = 'succeeded', result_json = ?, updated_at = ?, recovery_token = NULL, recovery_lease_until = NULL WHERE request_id = ? AND state = 'queued'" + predicate;
      const values = [JSON.stringify(resultValue), now(), requestId];
      if (recoveryToken) values.push(recoveryToken);
      const result = await db.prepare(sql).bind(...values).run();
      assert(Number(result && result.meta && result.meta.changes || 0) === 1, "DISPATCH_STATE_CONFLICT", "Dispatch record could not be marked succeeded by this process.");
    }
  });
}
