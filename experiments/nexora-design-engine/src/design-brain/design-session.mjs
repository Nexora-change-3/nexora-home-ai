import { buildRoomDesign } from "./build-room-design.mjs";
import { createAiDesignConcepts } from "./ai-design-brain.mjs";
import { analyzeDesignReference } from "../vision/analyze-design-reference.mjs";

/**
 * Runs the evidence-first room pipeline, then asks an injected text-model adapter
 * to develop three independent design concepts from the same original photo.
 * No image generation is performed here.
 */
export async function createDesignSession({
  visionAdapter,
  textAdapter,
  sourceImage,
  roomType,
  userBrief = "",
  stylePreference = "designer-led",
  intendedUse,
  dimensions,
  constraints = {},
  referenceImageIds = [],
  referenceImage = null
}) {
  if (!textAdapter || typeof textAdapter.generateText !== "function") {
    throw new TypeError("A textAdapter.generateText implementation is required.");
  }

  const evidence = await buildRoomDesign({
    adapter: visionAdapter,
    sourceImage,
    roomType,
    userBrief,
    stylePreference,
    intendedUse,
    dimensions,
    constraints,
    referenceImageIds
  });

  const referenceAnalysis = referenceImage ? await analyzeDesignReference({ adapter: visionAdapter, referenceImage }) : null;
  const effectiveReferenceImageIds = referenceImage ? [...referenceImageIds, referenceImage.id] : referenceImageIds;

  const aiDesign = await createAiDesignConcepts({
    adapter: textAdapter,
    input: {
      sourceImageId: sourceImage.id,
      roomType,
      userBrief,
      stylePreference,
      intendedUse,
      dimensions,
      referenceImageIds: effectiveReferenceImageIds,
      referenceAnalysis,
      roomAnalysis: evidence.vision,
      constraintLedger: evidence.constraint_ledger
    }
  });

  return {
    status: "design_concepts_ready",
    source_image_id: sourceImage.id,
    source_image_immutable: true,
    evidence,
    reference_analysis: referenceAnalysis,
    ai_design: aiDesign,
    rendering_performed: false,
    human_review_required: true
  };
}
