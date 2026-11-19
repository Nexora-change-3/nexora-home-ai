/**
 * Provider-neutral AI Design Brain boundary.
 * Builds a constrained design brief for a text model and validates its JSON response.
 * This module does not call a model or render images.
 */

const REQUIRED_TEXT = [
  "name",
  "design_thesis",
  "layout_strategy",
  "focal_point",
  "functional_rationale",
  "render_instructions"
];
const REQUIRED_ARRAYS = ["material_palette", "lighting_strategy", "furniture_direction", "preserve", "replace"];
const DIRECTIONS = ["concept_id", ...REQUIRED_TEXT, ...REQUIRED_ARRAYS];

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9а-яё]+/giu, " ").trim();
}

function assertInput(input) {
  if (!input || typeof input !== "object") throw new TypeError("Design Brain input must be an object.");
  if (!nonEmptyString(input.sourceImageId)) throw new TypeError("sourceImageId is required.");
  if (!nonEmptyString(input.roomType)) throw new TypeError("roomType is required.");
  if (!input.roomAnalysis || typeof input.roomAnalysis !== "object") throw new TypeError("roomAnalysis is required.");
  if (!input.constraintLedger || typeof input.constraintLedger !== "object") throw new TypeError("constraintLedger is required.");
}

export function buildDesignBrainPrompt(input) {
  assertInput(input);
  const payload = {
    source_image_id: input.sourceImageId,
    room_type: input.roomType,
    user_brief: input.userBrief ?? "",
    style_preference: input.stylePreference ?? "designer-led",
    intended_use: input.intendedUse ?? "",
    verified_dimensions: input.dimensions ?? null,
    room_analysis: input.roomAnalysis,
    constraint_ledger: input.constraintLedger,
    reference_image_ids: input.referenceImageIds ?? []
  };
  return {
    system: [
      "You are NEXORA DESIGN BRAIN, a senior interior architect and spatial designer.",
      "Return ONLY valid JSON. Do not include markdown fences or commentary.",
      "Create exactly three genuinely different, professionally coherent interior design concepts for the SAME source room.",
      "The concepts must differ in design thesis, spatial strategy, material choices and visual focal point; changing only colours is invalid.",
      "Treat the source image as immutable evidence of the existing room. Never invent dimensions or claim an unverified measurement.",
      "Respect fixed and preserved constraints. Never move openings, structural elements or services unless the user explicitly authorizes it and the constraint ledger permits it.",
      "An item marked unknown is not permission to remove or replace it. Do not decide it is replaceable without explicit user authorization.",
      "Do not invent windows, doors, appliances, plumbing, fireplaces or room extensions.",
      "Design for the room's stated use, safe clearances, access and plausible construction.",
      "Each concept must specify concrete material finishes, lighting layers, furniture direction, focal point and a detailed image-render instruction.",
      "Include preserve and replace arrays listing only explicit decisions supported by the constraint ledger.",
      "If evidence is insufficient, state the uncertainty in functional_rationale and avoid unsupported changes."
    ].join("\n"),
    user: [
      "Create three concepts using this input JSON:",
      JSON.stringify(payload),
      "",
      "Required response shape:",
      JSON.stringify({
        source_image_id: input.sourceImageId,
        source_image_immutable: true,
        concepts: [{
          concept_id: "unique-id",
          name: "short distinct design title",
          design_thesis: "specific concept rationale",
          layout_strategy: "spatial organization without unsupported geometry changes",
          material_palette: ["surface, finish, tone, intended location"],
          lighting_strategy: ["layer, fixture type, effect"],
          furniture_direction: ["piece, form, material, placement rule"],
          focal_point: "one clear visual anchor",
          functional_rationale: "how room functions and circulation are supported",
          preserve: ["ledger-backed preserved element"],
          replace: ["only explicitly replaceable element"],
          render_instructions: "detailed photorealistic image-edit instruction tied to the source photo"
        }]
      }, null, 2),
      "Return exactly three concept objects. Every listed field is required. Arrays must be non-empty except preserve or replace may be empty."
    ].join("\n")
  };
}

export function validateDesignBrainResponse(raw, expectedSourceImageId) {
  let parsed = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); }
    catch { return { valid: false, errors: ["Response is not valid JSON."] }; }
  }
  const errors = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, errors: ["Response must be a JSON object."] };
  }
  if (parsed.source_image_id !== expectedSourceImageId) errors.push("Source image ID does not match the original input.");
  if (parsed.source_image_immutable !== true) errors.push("The source image must be explicitly marked immutable.");
  if (!Array.isArray(parsed.concepts) || parsed.concepts.length !== 3) {
    errors.push("Exactly three concepts are required.");
    return { valid: false, errors };
  }
  const ids = new Set();
  const theses = new Set();
  const signatures = new Set();
  parsed.concepts.forEach((concept, index) => {
    const prefix = `concepts[${index}]`;
    if (!concept || typeof concept !== "object" || Array.isArray(concept)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    for (const key of DIRECTIONS) {
      if (key === "concept_id") {
        if (!nonEmptyString(concept[key])) errors.push(`${prefix}.concept_id is required.`);
      } else if (REQUIRED_TEXT.includes(key) && !nonEmptyString(concept[key])) {
        errors.push(`${prefix}.${key} is required.`);
      } else if (REQUIRED_ARRAYS.includes(key)) {
        if (!Array.isArray(concept[key])) errors.push(`${prefix}.${key} must be an array.`);
        else if (!["preserve", "replace"].includes(key) && (concept[key].length === 0 || concept[key].some(item => !nonEmptyString(item)))) {
          errors.push(`${prefix}.${key} must contain non-empty items.`);
        } else if (concept[key].some(item => !nonEmptyString(item))) {
          errors.push(`${prefix}.${key} items must be non-empty strings.`);
        }
      }
    }
    if (nonEmptyString(concept.concept_id)) {
      if (ids.has(concept.concept_id)) errors.push("Concept IDs must be unique.");
      ids.add(concept.concept_id);
    }
    const thesis = normalize(concept.design_thesis);
    if (thesis && theses.has(thesis)) errors.push("Design theses must be materially different.");
    if (thesis) theses.add(thesis);
    const signature = normalize([
      concept.design_thesis,
      concept.layout_strategy,
      ...(Array.isArray(concept.material_palette) ? concept.material_palette : []),
      concept.focal_point
    ].join(" "));
    if (signature && signatures.has(signature)) errors.push("Duplicate concept detected; cosmetic variations do not count.");
    if (signature) signatures.add(signature);
  });
  return { valid: errors.length === 0, errors, value: errors.length === 0 ? parsed : undefined };
}

/**
 * Adapter contract: generateText({system, user}) -> string or JSON object.
 * The adapter is injected; no provider, credentials or paid endpoint is hard-coded.
 */
export async function createAiDesignConcepts({ adapter, input }) {
  assertInput(input);
  if (!adapter || typeof adapter.generateText !== "function") {
    throw new TypeError("adapter.generateText is required.");
  }
  const prompt = buildDesignBrainPrompt(input);
  const raw = await adapter.generateText(prompt);
  const validation = validateDesignBrainResponse(raw, input.sourceImageId);
  if (!validation.valid) {
    const error = new Error("AI Design Brain response failed validation.");
    error.validation = validation;
    throw error;
  }
  return {
    status: "concepts_ready",
    source_image_id: input.sourceImageId,
    source_image_immutable: true,
    provider: adapter.provider ?? "injected",
    model_id: adapter.modelId ?? "unspecified",
    concepts: validation.value.concepts,
    validation: { valid: true, errors: [] },
    rendering_performed: false
  };
}
