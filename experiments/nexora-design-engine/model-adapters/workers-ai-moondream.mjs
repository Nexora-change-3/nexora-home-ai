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
      const response = await AI.run(modelId, {
        task: "query",
        image: dataUri,
        question: ROOM_ANALYSIS_PROMPT,
        reasoning: true,
        temperature: 0,
        max_tokens: 8192,
        stream: false
      });
      const parsed = parseModelAnswer(response);
      return {
        source_image_id: image.sourceImageId,
        observations: parsed.observations,
        uncertainties: parsed.uncertainties,
        dimension_hypotheses: parsed.dimension_hypotheses ?? []
      };
    }
  };
}

export { MODEL_ID as MOONDREAM_MODEL_ID };
