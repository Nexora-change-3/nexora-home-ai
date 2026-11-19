import test from "node:test";
import assert from "node:assert/strict";
import { createDesignConcepts, validateConceptSet } from "../src/design-brain/concept-planner.mjs";

const input = {
  sourceImageId: "user-original-photo-001",
  roomType: "kitchen",
  stylePreference: "contemporary",
  userBrief: "Create a genuinely new design, not a colour-only change.",
  constraints: {
    fixed: [{ element: "window", reason: "Existing opening must remain." }],
    preserve: ["room perimeter"],
    replaceable: ["cabinet fronts", "worktop", "lighting"],
    unknown: ["exact wall dimensions"]
  }
};

test("creates exactly three semantically distinct design directions", () => {
  const concepts = createDesignConcepts(input);
  assert.equal(concepts.length, 3);
  assert.equal(validateConceptSet(concepts).valid, true);
  assert.equal(new Set(concepts.map(c => c.design_concept.design_thesis)).size, 3);
  assert.equal(new Set(concepts.map(c => c.design_concept.materials.map(m => m.direction).join("|"))).size, 3);
});

test("keeps the original source immutable in every brief", () => {
  const concepts = createDesignConcepts(input);
  for (const concept of concepts) {
    assert.equal(concept.input.source_image_id, input.sourceImageId);
    assert.equal(concept.input.source_image_immutable, true);
  }
});

test("does not promote unknown dimensions into measurements", () => {
  const concepts = createDesignConcepts(input);
  for (const concept of concepts) {
    assert.equal(concept.room.dimensions, undefined);
    assert.match(concept.constraints.unknown[0].element, /exact wall dimensions/);
  }
});

test("preserves fixed architecture and allows only named replaceable items to be redesigned", () => {
  const concepts = createDesignConcepts(input);
  for (const concept of concepts) {
    assert.equal(concept.constraints.fixed[0].element, "window");
    assert.match(concept.design_concept.layout.architectural_change_policy, /Do not move/);
    assert.deepEqual(concept.constraints.replaceable.map(x => x.element), ["cabinet fronts", "worktop", "lighting"]);
  }
});

test("rejects missing source image rather than substituting another image", () => {
  assert.throws(() => createDesignConcepts({ roomType: "kitchen" }), /sourceImageId is required/);
});

test("rejects invalid verified dimensions", () => {
  assert.throws(() => createDesignConcepts({
    ...input,
    dimensions: { lengthM: -3, measurementStatus: "verified" }
  }), /must be a positive number/);
});

test("flags duplicate concept directions", () => {
  const concepts = createDesignConcepts(input);
  concepts[1].design_concept.concept_name = concepts[0].design_concept.concept_name;
  assert.equal(validateConceptSet(concepts).valid, false);
});

test("supports other room types without kitchen-specific assumptions", () => {
  const concepts = createDesignConcepts({ sourceImageId: "photo-2", roomType: "bedroom" });
  assert.equal(concepts[0].room.room_type, "bedroom");
  assert.ok(concepts[0].design_concept.functional_rationale.some(x => /bed/i.test(x)));
});
