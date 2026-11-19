/**
 * NEXORA Quality Gate — deterministic scoring and rejection policy (v0.1).
 * This module evaluates structured evidence supplied by future vision/human reviewers.
 * It does NOT inspect image pixels or claim automatic geometry recognition.
 */

export const QUALITY_WEIGHTS = Object.freeze({
  design_quality: 0.25,
  style_match: 0.20,
  geometry_preservation: 0.20,
  functionality: 0.15,
  photorealism: 0.10,
  concept_diversity: 0.10
});

const CRITICAL_CODES = new Set([
  "fixed_geometry_changed",
  "room_function_broken",
  "unsafe_or_impossible_layout",
  "source_image_mismatch"
]);

function validScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 5;
}

/**
 * @param {{
 *  scores: Record<string, number>,
 *  findings?: Array<{code:string,severity:"critical"|"major"|"minor",message?:string}>,
 *  evidence?: {sourceImageId?:string, candidateImageId?:string, reviewer?:string}
 * }} review
 */
export function evaluateCandidate(review) {
  const errors = [];
  if (!review || typeof review !== "object") {
    return { accepted: false, score: null, errors: ["A review object is required."], blockers: [] };
  }

  const scores = review.scores || {};
  for (const key of Object.keys(QUALITY_WEIGHTS)) {
    if (!validScore(scores[key])) errors.push(`Missing or invalid 0–5 score: ${key}.`);
  }

  const findings = Array.isArray(review.findings) ? review.findings : [];
  const blockers = findings.filter(item =>
    item?.severity === "critical" || CRITICAL_CODES.has(item?.code)
  );

  if (errors.length) {
    return { accepted: false, score: null, errors, blockers };
  }

  const weighted = Object.entries(QUALITY_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + scores[key] * weight, 0);
  const rounded = Math.round(weighted * 100) / 100;

  return {
    accepted: blockers.length === 0 && rounded >= 3.5,
    score: rounded,
    threshold: 3.5,
    errors: [],
    blockers,
    breakdown: Object.fromEntries(
      Object.entries(QUALITY_WEIGHTS).map(([key, weight]) => [
        key,
        { score: scores[key], weight, contribution: Math.round(scores[key] * weight * 100) / 100 }
      ])
    ),
    note: "A numerical score never overrides a critical blocker. Scores require human or separately validated machine evidence."
  };
}

/** Compare three concepts for structural difference before image generation. */
export function checkConceptDiversity(concepts) {
  if (!Array.isArray(concepts) || concepts.length !== 3) {
    return { valid: false, reason: "Exactly three concepts are required." };
  }
  const directions = concepts.map(c => c?.design_concept);
  const required = directions.every(d =>
    d && typeof d.design_thesis === "string" &&
    Array.isArray(d.materials) && d.materials.length >= 2 &&
    Array.isArray(d.color_palette) && d.color_palette.length >= 2 &&
    Array.isArray(d.distinctiveness_tags) && d.distinctiveness_tags.length >= 2
  );
  if (!required) return { valid: false, reason: "Each concept needs a thesis, material direction, palette and distinctiveness tags." };

  const uniqueTheses = new Set(directions.map(d => d.design_thesis)).size;
  const uniqueMaterialSets = new Set(directions.map(d => d.materials.map(m => m.direction).sort().join("|"))).size;
  const uniquePalettes = new Set(directions.map(d => d.color_palette.slice().sort().join("|"))).size;
  const uniqueTags = new Set(directions.map(d => d.distinctiveness_tags.slice().sort().join("|"))).size;

  const valid = uniqueTheses === 3 && uniqueMaterialSets === 3 &&
    uniquePalettes === 3 && uniqueTags === 3;

  return {
    valid,
    metrics: { uniqueTheses, uniqueMaterialSets, uniquePalettes, uniqueTags },
    reason: valid ? "Three materially distinct design directions detected." : "Concepts are too similar; do not count recolours as separate designs."
  };
}
