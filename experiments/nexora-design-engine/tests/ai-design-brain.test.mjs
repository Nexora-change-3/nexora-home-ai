import test from "node:test";
import assert from "node:assert/strict";
import { buildDesignBrainPrompt, validateDesignBrainResponse, createAiDesignConcepts } from "../src/design-brain/ai-design-brain.mjs";

const input = {
  sourceImageId: "user-kitchen-original",
  roomType: "kitchen",
  userBrief: "A genuinely new contemporary kitchen, not a recolour.",
  stylePreference: "contemporary",
  roomAnalysis: { observations: [{ label: "north window", category: "opening", confidence: 0.96 }] },
  constraintLedger: { fixed: [], preserve: [{ element: "north window" }], replaceable: [], unknown: [{ element: "existing cabinets" }] }
};

function concept(id, thesis, layout, material, focal) {
  return {
    concept_id: id,
    name: thesis.slice(0, 52),
    design_thesis: thesis,
    layout_strategy: layout,
    material_palette: [material],
    lighting_strategy: ["layered task lighting"],
    furniture_direction: ["integrated storage; placement only after clearance check"],
    focal_point: focal,
    functional_rationale: "Maintain safe circulation and practical work zones.",
    preserve: ["north window"],
    replace: [`${id} cabinet fronts`, `${id} worktops`, `${id} backsplash`],
    render_instructions: "Photorealistic redesign using the supplied original kitchen photograph; preserve the north window."
  };
}
const validResponse = {
  source_image_id: input.sourceImageId,
  source_image_immutable: true,
  concepts: [
    concept("a", "Monolithic architectural kitchen", "A linear calm composition", "pale limestone and smoked oak", "A sculptural stone island"),
    concept("b", "Warm crafted family kitchen", "A tactile social work zone", "honey oak and handmade ceramic", "A timber breakfast niche"),
    concept("c", "Graphic urban atelier kitchen", "A high-contrast modular composition", "brushed steel and deep green lacquer", "A dramatic metal extraction volume")
  ]
};

test("prompt carries original photo, constraints and non-recolour requirement", () => {
  const prompt = buildDesignBrainPrompt(input);
  assert.match(prompt.system, /changing only colours is invalid/);
  assert.match(prompt.user, /user-kitchen-original/);
  assert.match(prompt.user, /existing cabinets/);
});

test("accepts three materially different structured concepts", () => {
  const result = validateDesignBrainResponse(validResponse, input.sourceImageId);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("rejects malformed JSON and source image substitution", () => {
  assert.equal(validateDesignBrainResponse("{broken", input.sourceImageId).valid, false);
  const changed = { ...validResponse, source_image_id: "other-photo" };
  assert.equal(validateDesignBrainResponse(changed, input.sourceImageId).valid, false);
});

test("rejects missing design fields and duplicate concepts", () => {
  const missing = structuredClone(validResponse);
  delete missing.concepts[0].lighting_strategy;
  assert.equal(validateDesignBrainResponse(missing, input.sourceImageId).valid, false);
  const duplicate = structuredClone(validResponse);
  duplicate.concepts[1] = { ...duplicate.concepts[0], concept_id: "b" };
  assert.equal(validateDesignBrainResponse(duplicate, input.sourceImageId).valid, false);
});

test("adapter returns validated concepts without claiming image rendering", async () => {
  const result = await createAiDesignConcepts({
    input,
    adapter: { provider: "mock", modelId: "test-model", async generateText() { return validResponse; } }
  });
  assert.equal(result.status, "concepts_ready");
  assert.equal(result.rendering_performed, false);
  assert.equal(result.concepts.length, 3);
});

test("adapter fails closed when model returns invalid concepts", async () => {
  await assert.rejects(
    () => createAiDesignConcepts({ input, adapter: { async generateText() { return { ...validResponse, concepts: [] }; } } }),
    /failed validation/
  );
});

test("rejects concepts that replace fewer than three authorized elements", () => {
  const weak = structuredClone(validResponse);
  weak.concepts[0].replace = ["cabinet colour"];
  const result = validateDesignBrainResponse(weak, input.sourceImageId);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("at least three authorized design changes")));
});

test("rejects a set whose concepts repeat the same material palette and focal point", () => {
  const similar = structuredClone(validResponse);
  similar.concepts[2].material_palette = [...similar.concepts[0].material_palette];
  similar.concepts[2].focal_point = similar.concepts[0].focal_point;
  similar.concepts[2].layout_strategy = similar.concepts[0].layout_strategy;
  const result = validateDesignBrainResponse(similar, input.sourceImageId);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("too similar")));
});
