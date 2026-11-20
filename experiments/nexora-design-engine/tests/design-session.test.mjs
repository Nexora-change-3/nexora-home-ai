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
  major_design_moves: ["Recompose the cabinet architecture and storage hierarchy", "Introduce a new material and edge profile to the work surface", "Create a new architectural focal point with integrated lighting"],
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
    stylePreference: "contemporary",
    constraints: { replaceable: ["cabinet fronts", "worktops", "backsplash", "island finish", "lighting fixtures"] }
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

test("design session analyzes a separate visual reference and passes its design language to Design Brain", async () => {
  const referenceImage = { id: "reference-photo-id", contentType: "image/jpeg", bytes: new Uint8Array([4,5,6]) };
  const referenceAnalysis = {
    reference_image_id: referenceImage.id,
    design_language: "Quiet sculptural contemporary with warm natural materials",
    principles: { proportions:["large calm planes"], rhythm:["repeated vertical joinery"], material_hierarchy:["stone focal surface over matte timber"], contrast:["soft tonal contrast"], joinery_language:["integrated handleless fronts"], lighting:["concealed linear layers"], composition:["one dominant focal plane"], color_relationships:["warm neutral tonal palette"] },
    signature_elements:["monolithic stone focal plane"], adaptation_rules:["translate vertical rhythm to available cabinetry"], do_not_copy:["do not copy reference room layout"], uncertainties:[]
  };
  let capturedPrompt;
  const adapter = { provider:"mock-vision", modelId:"vision-test", async analyze(){return structuredClone(visionResult);}, async analyzeReference(){return structuredClone(referenceAnalysis);} };
  const text = { provider:"mock-text", modelId:"text-test", async generateText(prompt){capturedPrompt=prompt; return {source_image_id:sourceImage.id,source_image_immutable:true,concepts};} };
  const result = await createDesignSession({ visionAdapter:adapter, textAdapter:text, sourceImage, referenceImage, roomType:"kitchen", stylePreference:"contemporary", constraints:{replaceable:["cabinet fronts","worktops","backsplash","island finish","lighting fixtures"]} });
  assert.equal(result.reference_analysis.design_language, referenceAnalysis.design_language);
  assert.equal(result.reference_analysis.reference_image_id, referenceImage.id);
  assert.match(capturedPrompt.user, /repeated vertical joinery/);
  assert.match(capturedPrompt.system, /translate those principles to the source room/);
});
