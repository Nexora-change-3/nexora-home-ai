import test from "node:test";
import assert from "node:assert/strict";
import { createD1DispatchStore } from "../model-adapters/dispatch-ledger.mjs";

function createFakeD1() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              const row = rows.get(values[0]);
              return row ? structuredClone(row) : null;
            },
            async run() {
              if (sql.startsWith("INSERT OR IGNORE")) {
                const [request_id, source_image_ref, workflow_hash, created_at, updated_at] = values;
                if (rows.has(request_id)) return { meta: { changes: 0 } };
                rows.set(request_id, { request_id, source_image_ref, workflow_hash, state: "submitting", prompt_id: null, result_json: null, created_at, updated_at });
                return { meta: { changes: 1 } };
              }
              const keyIndex = sql.includes("result_json = ?") || sql.includes("prompt_id = ?") ? 2 : 1;
              const row = rows.get(values[keyIndex]);
              if (!row) return { meta: { changes: 0 } };
              if (sql.includes("SET state = 'succeeded'")) {
                if (row.state !== "queued") return { meta: { changes: 0 } };
                row.state = "succeeded"; row.result_json = values[0]; row.updated_at = values[1]; return { meta: { changes: 1 } };
              }
              if (sql.includes("SET state = 'queued'")) {
                if (!["submitting", "outcome_unknown"].includes(row.state)) return { meta: { changes: 0 } };
                row.state = "queued"; row.prompt_id = values[0]; row.updated_at = values[1]; return { meta: { changes: 1 } };
              }
              if (sql.includes("state = 'outcome_unknown'")) {
                if (row.state !== "submitting") return { meta: { changes: 0 } };
                row.state = "outcome_unknown"; row.updated_at = values[0]; return { meta: { changes: 1 } };
              }
              throw new Error("Unexpected SQL: " + sql);
            }
          };
        }
      };
    }
  };
}

test("D1 dispatch ledger survives store recreation and persists each state transition", async () => {
  const db = createFakeD1();
  const firstProcess = createD1DispatchStore(db, { now: () => "2026-11-19T00:00:00.000Z" });
  assert.equal(await firstProcess.claim({ requestId: "render-1", sourceImageRef: "source://1", workflowHash: "sha256:abc" }), true);
  const restarted = createD1DispatchStore(db, { now: () => "2026-11-19T00:01:00.000Z" });
  assert.equal(await restarted.claim({ requestId: "render-1", sourceImageRef: "source://1", workflowHash: "sha256:abc" }), false);
  assert.equal((await restarted.get("render-1")).state, "submitting");
  await restarted.markUnknown("render-1");
  assert.equal((await firstProcess.get("render-1")).state, "outcome_unknown");
  await firstProcess.markQueued("render-1", "comfy-prompt-123");
  assert.equal((await restarted.get("render-1")).prompt_id, "comfy-prompt-123");
  const result = { request_id: "render-1", status: "succeeded", image_ref: "result://1", prompt_id: "comfy-prompt-123" };
  await restarted.markSucceeded("render-1", result);
  assert.deepEqual((await createD1DispatchStore(db).get("render-1")).result, result);
  assert.equal(await firstProcess.claim({ requestId: "render-1", sourceImageRef: "source://1", workflowHash: "sha256:abc" }), false);
});

test("D1 store validates its binding and table identifier", () => {
  assert.throws(() => createD1DispatchStore(null), { code: "INVALID_D1_BINDING" });
  assert.throws(() => createD1DispatchStore(createFakeD1(), { tableName: "dispatch; DROP TABLE x" }), { code: "INVALID_TABLE_NAME" });
});

test("duplicate request identifiers cannot overwrite the original D1 claim", async () => {
  const store = createD1DispatchStore(createFakeD1());
  assert.equal(await store.claim({ requestId: "same-id", sourceImageRef: "source://one", workflowHash: "sha256:one" }), true);
  assert.equal(await store.claim({ requestId: "same-id", sourceImageRef: "source://two", workflowHash: "sha256:two" }), false);
  const row = await store.get("same-id");
  assert.equal(row.source_image_ref, "source://one");
  assert.equal(row.workflow_hash, "sha256:one");
});
