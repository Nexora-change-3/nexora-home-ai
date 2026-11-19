import test from "node:test";
import assert from "node:assert/strict";
import { createDesignSession } from "../src/design-brain/design-session.mjs";

const sourceImage = { id: "original-room-photo", contentType: "image/jpeg", bytes: new Uint8Array([1,2,3]) };
const visionResult = {
  source_image_id: sourceImage.id,
  observations: [
    { observation_id: "window-1", label: "north window", category: "opening", confidence: 0.98, visibility: "clear" },
    { observation_id: "cabinet-1", label: "existing cabinet", category: "furniture", confidence: 0.84, visibility: "partial" }
  ],
  uncertainties: [],
  dimension_hypotheses: []
};
const concepts = ["a","b","c"].map((id, i) => ({
  concept_id: id,
  name: ["Architectural", "Warm crafted", "Expressive atelier"][i],
  design_thesis: ["Architectural stone-led composition","Warm timber and tactile family kitchen","Expressive dark metal atelier kitchen"][i],
  layout_strategy: ["Linear work zone","Social preparation zone","Modular contrast zone"][i],
  material_palette: [["limestone"],["oak and ceramic"],["steel and lacquer"]][i],
  lighting_strategy: ["layered lighting"],
  furniture_direction: ["integrated storage"],
  focal_point: ["stone island","timber niche","metal hood"][i],
  functional_rationale: "Maintain practical circulation and appliance access.",
  preserve: ["north window"],
  replace: [["cabinet fronts","worktops","backsplash"],["cabinet fronts","backsplash","island finish"],["cabinet fronts","worktops","lighting fixtures"]][i],
  render_instructions: "Create a substantial photorealistic redesign based on the original photo."
}));
const textAdapter = { provider: "mock", modelId: "test", async generateText() {
  return { source_image_id: sourceImage.id, source_image_immutable: true, concepts };
}};

test("design session connects photo vision, constraint ledger and AI concept adapter", async () => {
  const result = await createDesignSession({
    visionAdapter: { provider: "mock-vision", modelId: "vision-test", async analyze() { return structuredClone(visionResult); } },
    textAdapter,
    sourceImage,
    roomType: "kitchen",
    stylePreference: "contemporary"
  });
  assert.equal(result.status, "design_concepts_ready");
  assert.equal(result.source_image_immutable, true);
  assert.equal(result.ai_design.concepts.length, 3);
  assert.equal(result.evidence.constraint_ledger.constraints.preserve.some(x => x.element === "north window"), true);
  assert.equal(result.evidence.constraint_ledger.constraints.unknown.some(x => x.element === "existing cabinet"), true);
  assert.equal(result.rendering_performed, false);
  assert.equal(result.human_review_required, true);
});

test("design session refuses to proceed without a text model adapter", async () => {
  await assert.rejects(() => createDesignSession({ sourceImage, roomType: "kitchen" }), /textAdapter/);
});
