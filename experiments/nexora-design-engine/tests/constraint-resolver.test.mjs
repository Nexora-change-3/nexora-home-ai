import test from "node:test";
import assert from "node:assert/strict";
import { resolveConstraintLedger } from "../src/constraints/resolve-constraints.mjs";

test("explicit user constraint overrides conflicting vision classification", () => {
  const result = resolveConstraintLedger({
    user: [{ element: "window", disposition: "fixed", reason: "Must not move." }],
    vision: [{ element: "window", disposition: "replaceable", confidence: 0.99 }]
  });
  assert.equal(result.constraints.fixed[0].source, "user");
  assert.equal(result.constraints.replaceable.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.requires_review, true);
});

test("verified measurement outranks a vision hypothesis", () => {
  const result = resolveConstraintLedger({
    verifiedMeasurements: [{ element: "wall length", disposition: "preserve", measurement: { value: 4.2, unit: "m" } }],
    vision: [{ element: "wall length", disposition: "unknown", confidence: 0.4 }]
  });
  assert.equal(result.constraints.preserve[0].source, "verified_measurement");
});

test("vision-only detections remain unknown unless they explicitly describe a safe observation", () => {
  const result = resolveConstraintLedger({
    vision: [{ element: "possible doorway", disposition: "unknown", confidence: 0.72 }]
  });
  assert.equal(result.constraints.unknown.length, 1);
  assert.equal(result.requires_review, true);
});

test("rejects invalid confidence and unsupported dispositions", () => {
  assert.throws(() => resolveConstraintLedger({
    vision: [{ element: "door", disposition: "replaceable", confidence: 1.2 }]
  }), /confidence/);
  assert.throws(() => resolveConstraintLedger({
    user: [{ element: "door", disposition: "maybe" }]
  }), /disposition/);
});

test("does not silently resolve two conflicting instructions from the same source", () => {
  const result = resolveConstraintLedger({
    user: [
      { element: "cabinet", disposition: "fixed", reason: "Keep carcass." },
      { element: "cabinet", disposition: "replaceable", reason: "Replace cabinet." }
    ]
  });
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.requires_review, true);
});
