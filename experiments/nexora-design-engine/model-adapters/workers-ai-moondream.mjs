const MODEL_ID = "@cf/moondream/moondream3.1-9B-A2B";

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function parseModelAnswer(response) {
  const answer = response?.answer ?? response?.result?.answer ?? response;
  if (answer && typeof answer === "object" && !Array.isArray(answer)) return answer;
  if (typeof answer !== "string") throw new TypeError("Moondream returned no structured answer text.");
  const cleaned = answer.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Moondream answer was not valid JSON; refusing to pass unstructured observations into Design Brain.");
  }
}

const REFERENCE_ANALYSIS_PROMPT = `Analyze this image ONLY as a visual design reference for a different room. Extract its transferable design language, not its room layout or architecture. Return ONLY JSON with exactly these keys: design_language, principles, signature_elements, adaptation_rules, do_not_copy, uncertainties.

design_language: concise description of the overall design identity. principles must contain arrays of 1-4 concrete observations for each key: proportions, rhythm, material_hierarchy, contrast, joinery_language, lighting, composition, color_relationships. signature_elements: 2-5 recognizable design cues. adaptation_rules: 2-5 actionable rules for translating the visual language to another room. do_not_copy: 2-5 items that must NOT be copied literally (objects, layout, architecture, room proportions, camera, openings). uncertainties: array of uncertain interpretations, may be empty.

Do NOT infer dimensions, wall positions, openings, room type, services or structural facts from this reference. Do NOT treat the reference as permission to move or replace anything in the user's source room. Do NOT reproduce the reference room literally. Focus on proportions, material hierarchy, visual rhythm, contrast, joinery language, lighting and composition. No markdown or extra text.`;

const ROOM_ANALYSIS_PROMPT = `Inspect this room photograph as a cautious architectural-vision assistant. Return ONLY a JSON object with exactly these top-level keys: observations, uncertainties, dimension_hypotheses.

observations must be an array of visible items. Each item: observation_id (short unique string), label (plain description), category (one of architecture, opening, surface, furniture, appliance, lighting, decor, other), confidence (number 0..1), visibility (one of clear, partial, occluded, ambiguous), and image_region (normalized x,y,width,height from 0..1 when you can locate it reliably). Include visible walls, floor, ceiling, windows, doors, fixed openings, cabinets, appliances, furniture and lights where identifiable.

uncertainties must list important areas or objects that are hidden, ambiguous, or cannot be classified reliably, with subject and reason, and optional recommended_confirmation.

dimension_hypotheses must be an empty array. Do not estimate room dimensions, wall lengths, ceiling height, or distances from this single photograph. Do not invent unseen objects or infer structural facts. Do not recommend moving, removing, or replacing any architectural element. Do not include markdown fences or explanatory text.`;

export function createMoondreamWorkersAIAdapter({ AI, modelId = MODEL_ID } = {}) {
  if (!AI || typeof AI.run !== "function") throw new TypeError("A Workers AI binding with run() is required.");
  if (typeof modelId !== "string" || !modelId.trim()) throw new TypeError("A modelId is required.");
  return {
    provider: "cloudflare-workers-ai",
    modelId,
    modelVersion: "moondream-3.1",
    async analyze({ image }) {
      const dataUri = `data:${image.contentType};base64,${toBase64(image.bytes)}`;
      const response = await AI.run(modelId, { task: "query", image: dataUri, question: ROOM_ANALYSIS_PROMPT, reasoning: true, temperature: 0, max_tokens: 8192, stream: false });
      const parsed = parseModelAnswer(response);
      return { source_image_id: image.sourceImageId, observations: parsed.observations, uncertainties: parsed.uncertainties, dimension_hypotheses: parsed.dimension_hypotheses ?? [] };
    },
    async analyzeReference({ image }) {
      const dataUri = `data:${image.contentType};base64,${toBase64(image.bytes)}`;
      const response = await AI.run(modelId, { task: "query", image: dataUri, question: REFERENCE_ANALYSIS_PROMPT, reasoning: true, temperature: 0, max_tokens: 8192, stream: false });
      const parsed = parseModelAnswer(response);
      return { reference_image_id: image.sourceImageId, ...parsed };
    }
  };
}

export { MODEL_ID as MOONDREAM_MODEL_ID };
