const PRINCIPLE_KEYS = ["proportions", "rhythm", "material_hierarchy", "contrast", "joinery_language", "lighting", "composition", "color_relationships"];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
function requiredText(value, field) { if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} must be a non-empty string.`); return value.trim(); }
function textList(value, field, min = 1, max = 6) {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some(x => typeof x !== "string" || !x.trim())) throw new TypeError(`${field} must contain ${min}-${max} non-empty strings.`);
  return value.map(x => x.trim());
}
/** Analyze only the visual design language of a reference image, never its room geometry. */
export async function analyzeDesignReference({ adapter, referenceImage } = {}) {
  if (!adapter || typeof adapter.analyzeReference !== "function") throw new TypeError("A vision adapter with analyzeReference() is required for a design reference.");
  if (!referenceImage || typeof referenceImage !== "object") throw new TypeError("referenceImage is required.");
  const id = requiredText(referenceImage.id, "referenceImage.id");
  if (!IMAGE_TYPES.has(referenceImage.contentType)) throw new TypeError("referenceImage.contentType must be JPEG, PNG, or WebP.");
  const bytes = referenceImage.bytes instanceof ArrayBuffer ? new Uint8Array(referenceImage.bytes) : referenceImage.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new TypeError("referenceImage.bytes must contain image bytes.");
  const raw = await adapter.analyzeReference({ image: { sourceImageId: id, contentType: referenceImage.contentType, bytes: Uint8Array.from(bytes) } });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Reference vision result must be an object.");
  if (raw.reference_image_id !== id) throw new Error("Reference analysis ID does not match the supplied image.");
  const principles = {};
  for (const key of PRINCIPLE_KEYS) principles[key] = textList(raw.principles?.[key], `principles.${key}`);
  return Object.freeze({
    schema_version: "1.0.0", reference_image_id: id,
    model: Object.freeze({ provider: requiredText(adapter.provider, "adapter.provider"), model_id: requiredText(adapter.modelId, "adapter.modelId"), model_version: adapter.modelVersion ?? "unspecified" }),
    design_language: requiredText(raw.design_language, "design_language"),
    principles: Object.freeze(principles),
    signature_elements: textList(raw.signature_elements, "signature_elements"),
    adaptation_rules: textList(raw.adaptation_rules, "adaptation_rules"),
    do_not_copy: textList(raw.do_not_copy, "do_not_copy"),
    uncertainties: Array.isArray(raw.uncertainties) ? raw.uncertainties.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()) : []
  });
}
export { PRINCIPLE_KEYS as DESIGN_REFERENCE_PRINCIPLE_KEYS };
