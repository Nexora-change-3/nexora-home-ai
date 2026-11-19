const CATEGORIES = new Set(["architecture","opening","surface","furniture","appliance","lighting","decor","other"]);
const VISIBILITY = new Set(["clear","partial","occluded","ambiguous"]);
const IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp"]);

function text(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} must be a non-empty string.`);
  return value.trim();
}
function region(value, index) {
  if (value === undefined) return;
  if (!value || typeof value !== "object") throw new TypeError(`observations[${index}].image_region must be an object.`);
  for (const key of ["x","y","width","height"]) {
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) throw new TypeError(`observations[${index}].image_region.${key} must be between 0 and 1.`);
  }
  if (value.x + value.width > 1.000001 || value.y + value.height > 1.000001) throw new TypeError("image_region must stay inside the image.");
}
function validate(raw, imageId, model) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Vision adapter must return an analysis object.");
  if (raw.source_image_id !== imageId) throw new Error("Vision result source_image_id does not match the supplied original photo.");
  if (!Array.isArray(raw.observations) || !Array.isArray(raw.uncertainties)) throw new TypeError("Vision result must include observations and uncertainties arrays.");
  const observations = raw.observations.map((item, i) => {
    text(item?.observation_id, `observations[${i}].observation_id`);
    const label = text(item.label, `observations[${i}].label`);
    if (!CATEGORIES.has(item.category)) throw new TypeError(`observations[${i}].category is unsupported.`);
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) throw new TypeError(`observations[${i}].confidence must be between 0 and 1.`);
    if (!VISIBILITY.has(item.visibility)) throw new TypeError(`observations[${i}].visibility is unsupported.`);
    region(item.image_region, i);
    return { observation_id:item.observation_id, label, category:item.category, confidence:item.confidence, visibility:item.visibility, ...(item.image_region ? {image_region:{...item.image_region}} : {}), ...(typeof item.notes === "string" ? {notes:item.notes} : {}) };
  });
  const uncertainties = raw.uncertainties.map((item,i) => ({
    subject:text(item?.subject,`uncertainties[${i}].subject`),
    reason:text(item?.reason,`uncertainties[${i}].reason`),
    ...(typeof item.recommended_confirmation === "string" ? {recommended_confirmation:item.recommended_confirmation} : {})
  }));
  const dimensions = (raw.dimension_hypotheses ?? []).map((item,i) => {
    if (!Number.isFinite(item?.estimate) || item.estimate <= 0) throw new TypeError(`dimension_hypotheses[${i}].estimate must be positive.`);
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) throw new TypeError(`dimension_hypotheses[${i}].confidence must be between 0 and 1.`);
    if (item.status !== "vision_estimated") throw new Error("Vision-derived dimensions must remain marked vision_estimated.");
    return {subject:text(item.subject,`dimension_hypotheses[${i}].subject`),estimate:item.estimate,unit:text(item.unit,`dimension_hypotheses[${i}].unit`),confidence:item.confidence,status:"vision_estimated"};
  });
  return Object.freeze({
    schema_version:"1.0.0", source_image_id:imageId,
    model:Object.freeze({provider:model.provider,model_id:model.modelId,model_version:model.modelVersion ?? "unspecified"}),
    observations:Object.freeze(observations), uncertainties:Object.freeze(uncertainties), dimension_hypotheses:Object.freeze(dimensions),
    review_required:uncertainties.length>0 || observations.some(x=>x.confidence<0.75 || x.visibility!=="clear") || dimensions.length>0
  });
}

/** Run a selected provider adapter against the identified original image. */
export async function analyzeRoomPhoto({adapter,sourceImage,context={}}={}) {
  if (!adapter || typeof adapter.analyze !== "function") throw new TypeError("A vision adapter with an analyze() method is required.");
  const provider=text(adapter.provider,"adapter.provider"), modelId=text(adapter.modelId,"adapter.modelId");
  if (!sourceImage || typeof sourceImage !== "object") throw new TypeError("The original sourceImage is required; substitute images are not accepted.");
  const sourceImageId=text(sourceImage.id,"sourceImage.id");
  if (!IMAGE_TYPES.has(sourceImage.contentType)) throw new TypeError("sourceImage.contentType must be JPEG, PNG, or WebP.");
  const bytes=sourceImage.bytes instanceof ArrayBuffer ? new Uint8Array(sourceImage.bytes) : sourceImage.bytes;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength===0) throw new TypeError("sourceImage.bytes must contain the original image bytes.");
  const raw=await adapter.analyze({image:{sourceImageId,contentType:sourceImage.contentType,bytes:Uint8Array.from(bytes)},context:structuredClone(context)});
  return validate(raw,sourceImageId,{provider,modelId,modelVersion:adapter.modelVersion});
}
