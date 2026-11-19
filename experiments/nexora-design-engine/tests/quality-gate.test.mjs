import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, checkConceptDiversity } from "../src/quality-gate/quality-gate.mjs";
import { createDesignConcepts } from "../src/design-brain/concept-planner.mjs";

const goodScores = {
  design_quality: 4.5,
  style_match: 4,
  geometry_preservation: 4.5,
  functionality: 4,
  photorealism: 4,
  concept_diversity: 4.5
};

test("accepts a sufficiently strong review with no critical findings", () => {
  const result = evaluateCandidate({ scores: goodScores, findings: [] });
  assert.equal(result.accepted, true);
  assert.equal(result.score, 4.25);
});

test("critical geometry failure blocks even a high score", () => {
  const result = evaluateCandidate({
    scores: Object.fromEntries(Object.keys(goodScores).map(k => [k, 5])),
    findings: [{ code: "fixed_geometry_changed", severity: "major", message: "Window moved." }]
  });
  assert.equal(result.accepted, false);
  assert.equal(result.blockers.length, 1);
});

test("rejects incomplete or out-of-range scores", () => {
  const result = evaluateCandidate({ scores: { ...goodScores, style_match: 8 } });
  assert.equal(result.accepted, false);
  assert.equal(result.score, null);
  assert.ok(result.errors.length > 0);
});

test("does not accept low quality merely because there are no blockers", () => {
  const result = evaluateCandidate({
    scores: Object.fromEntries(Object.keys(goodScores).map(k => [k, 2])),
    findings: []
  });
  assert.equal(result.accepted, false);
  assert.equal(result.score, 2);
});

test("recognizes three genuinely distinct concept structures", () => {
  const concepts = createDesignConcepts({ sourceImageId: "fixture", roomType: "kitchen" });
  assert.equal(checkConceptDiversity(concepts).valid, true);
});

test("rejects cosmetic duplicates", () => {
  const concepts = createDesignConcepts({ sourceImageId: "fixture", roomType: "kitchen" });
  concepts[2].design_concept.materials = structuredClone(concepts[0].design_concept.materials);
  concepts[2].design_concept.color_palette = [...concepts[0].design_concept.color_palette];
  concepts[2].design_concept.distinctiveness_tags = [...concepts[0].design_concept.distinctiveness_tags];
  assert.equal(checkConceptDiversity(concepts).valid, false);
});
