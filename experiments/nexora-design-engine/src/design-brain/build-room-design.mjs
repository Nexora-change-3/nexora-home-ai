import { analyzeRoomPhoto } from "../vision/analyze-room-photo.mjs";
import { resolveConstraintLedger } from "../constraints/resolve-constraints.mjs";
import { createDesignConcepts, validateConceptSet } from "./concept-planner.mjs";

const USER_DISPOSITIONS = ["fixed", "preserve", "replaceable", "unknown"];

function userRecords(groups = {}) {
  const records = [];
  for (const disposition of USER_DISPOSITIONS) {
    for (const value of groups[disposition] ?? []) {
      const record = typeof value === "string" ? { element: value } : value;
      if (!record || typeof record.element !== "string" || !record.element.trim()) {
        throw new TypeError(`User ${disposition} constraints must identify an element.`);
      }
      records.push({
        element: record.element,
        disposition,
        reason: typeof record.reason === "string" ? record.reason : "Explicit user-provided constraint."
      });
    }
  }
  return records;
}

function visionRecords(analysis) {
  return analysis.observations.map(item => {
    // Architecture/openings are protected conservatively. Other detections
    // remain unknown; vision cannot declare an item replaceable.
    const disposition = ["architecture", "opening"].includes(item.category) ? "preserve" : "unknown";
    return {
      element: item.label,
      disposition,
      reason: `Vision observation (${item.observation_id}, confidence ${item.confidence}); confirmation required before any design change.`,
      confidence: item.confidence
    };
  });
}

/**
 * End-to-end orchestration from the original room photo to three structured
 * design briefs. This does not render images or claim that the vision provider
 * has been empirically validated.
 */
export async function buildRoomDesign({
  adapter,
  sourceImage,
  roomType,
  userBrief = "",
  stylePreference = "designer-led",
  intendedUse,
  dimensions,
  constraints = {},
  referenceImageIds = []
} = {}) {
  if (typeof roomType !== "string" || !roomType.trim()) throw new TypeError("roomType is required.");
  const vision = await analyzeRoomPhoto({ adapter, sourceImage });
  const ledger = resolveConstraintLedger({
    user: userRecords(constraints),
    vision: visionRecords(vision)
  });

  const geometryObservations = vision.observations.map(item => ({
    element: item.label,
    status: item.visibility === "clear" && item.confidence >= 0.75 ? "observed" : "uncertain",
    confidence: item.confidence,
    notes: `category=${item.category}; visibility=${item.visibility}; observation_id=${item.observation_id}`
  }));

  const concepts = createDesignConcepts({
    sourceImageId: sourceImage.id,
    roomType,
    userBrief,
    stylePreference,
    intendedUse,
    dimensions,
    referenceImageIds,
    geometryObservations,
    constraints: ledger.constraints
  });
  const validation = validateConceptSet(concepts);

  return {
    status: validation.valid ? "briefs_ready" : "blocked",
    source_image_id: sourceImage.id,
    source_image_immutable: true,
    vision,
    constraint_ledger: ledger,
    concepts,
    concept_validation: validation,
    human_review_required: vision.review_required || ledger.requires_review,
    limitations: [
      "Vision detections are hypotheses, not verified measurements.",
      "Vision alone never marks an element replaceable.",
      "No image rendering or pixel-level geometry comparison occurs in this pipeline."
    ]
  };
}
