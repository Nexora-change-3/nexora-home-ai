/**
 * NEXORA Design Brain — deterministic concept planner (v0.1).
 * This module creates structured design directions; it does not call an image model.
 * Unknown geometry is never promoted to a measurement or permission to move a fixed element.
 */

const ARCHETYPES = [
  {
    id: "architectural",
    name: "Architectural clarity",
    thesis: "A disciplined, architectural composition with a few strong material statements.",
    palette: ["chalk", "warm grey", "graphite"],
    materials: ["matte mineral surface", "large-format stone or porcelain", "dark anodized metal"],
    lighting: ["concealed linear task lighting", "precise architectural accent lighting"],
    furniture: ["integrated, visually quiet storage", "clean-lined pieces with restrained profiles"],
    decor: ["one sculptural focal object", "minimal objects with generous negative space"],
    layout: "Clarify functional zones and sightlines without moving fixed architectural elements.",
    tags: ["restrained", "architectural", "high-contrast-detail"]
  },
  {
    id: "organic",
    name: "Warm natural living",
    thesis: "A tactile, welcoming interior built around natural textures, soft transitions and human comfort.",
    palette: ["natural oak", "sand", "warm white", "muted olive"],
    materials: ["natural wood veneer", "honed stone", "woven or textured natural fibre"],
    lighting: ["warm layered ambient lighting", "diffused task lighting"],
    furniture: ["softened silhouettes", "natural timber details", "comfortable practical seating where appropriate"],
    decor: ["large-scale natural texture", "edited greenery and handcrafted accents"],
    layout: "Prioritise comfortable everyday use, accessible storage and clear circulation.",
    tags: ["warm", "natural", "tactile"]
  },
  {
    id: "expressive",
    name: "Expressive contemporary",
    thesis: "A confident, editorial interior using a deliberate focal point, material contrast and distinctive forms.",
    palette: ["deep ink", "clay", "brushed bronze", "soft ivory"],
    materials: ["coloured lacquer or stained timber", "expressive stone", "brushed metal"],
    lighting: ["statement pendant or sculptural fixture", "focused accent lighting"],
    furniture: ["one distinctive focal piece", "contrasting forms balanced by functional clearances"],
    decor: ["large art or a crafted focal object", "limited high-impact accessories"],
    layout: "Build a clear focal hierarchy while keeping all required functions and circulation usable.",
    tags: ["expressive", "editorial", "material-contrast"]
  }
];

const ROOM_NOTES = {
  kitchen: {
    functions: ["food preparation", "washing", "cooking", "storage", "safe appliance access"],
    checks: ["Keep sink, hob and refrigerator access practical.", "Do not block appliance doors, drawers or work surfaces."]
  },
  living_room: {
    functions: ["seating", "conversation", "media or focal-point use", "circulation"],
    checks: ["Keep comfortable access around seating.", "Do not invent a television or fireplace if not requested."]
  },
  bedroom: {
    functions: ["sleeping", "clothing storage", "bedside access", "comfortable circulation"],
    checks: ["Keep access to both sides of the bed where the plan allows.", "Do not obstruct wardrobes or doors."]
  },
  bathroom: {
    functions: ["washing", "showering or bathing", "toilet use if present", "storage"],
    checks: ["Keep wet and dry functions sensible.", "Do not relocate plumbing fixtures unless explicitly allowed and technically verified."]
  },
  hallway: {
    functions: ["entry", "outerwear and shoe storage", "clear passage"],
    checks: ["Keep the required passage clear.", "Do not obstruct door swings."]
  },
  office: {
    functions: ["work surface", "task lighting", "equipment storage", "ergonomics"],
    checks: ["Maintain practical desk access and task lighting.", "Keep cables and equipment placement plausible."]
  },
  studio: {
    functions: ["sleeping", "living", "storage", "circulation"],
    checks: ["Use clear zones without making the space feel subdivided beyond its size.", "Keep the main circulation path clear."]
  },
  other: {
    functions: ["the room's stated primary function"],
    checks: ["Respect the stated use of the room."]
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConstraint(value, source) {
  if (typeof value === "string") return { element: value, reason: "Provided as a room constraint.", source };
  if (value && typeof value === "object" && typeof value.element === "string") {
    return {
      element: value.element,
      reason: typeof value.reason === "string" ? value.reason : "Provided room constraint.",
      source: value.source || source,
      ...(Number.isFinite(value.confidence) ? { confidence: value.confidence } : {})
    };
  }
  throw new TypeError("Each constraint must be a string or an object with an element.");
}

function assertInput(input) {
  if (!input || typeof input !== "object") throw new TypeError("Input must be an object.");
  if (typeof input.sourceImageId !== "string" || !input.sourceImageId.trim()) {
    throw new TypeError("sourceImageId is required; the planner never creates a substitute source image.");
  }
  if (typeof input.roomType !== "string" || !input.roomType.trim()) {
    throw new TypeError("roomType is required.");
  }
  if (input.dimensions && input.dimensions.measurementStatus === "verified") {
    for (const key of ["lengthM", "widthM", "heightM"]) {
      if (input.dimensions[key] !== undefined && !(Number.isFinite(input.dimensions[key]) && input.dimensions[key] > 0)) {
        throw new TypeError(`Verified dimension ${key} must be a positive number.`);
      }
    }
  }
}

function buildConcept(input, archetype, index) {
  const fixed = asArray(input.constraints?.fixed).map(v => normalizeConstraint(v, "user"));
  const preserve = asArray(input.constraints?.preserve).map(v => normalizeConstraint(v, "user"));
  const replaceable = asArray(input.constraints?.replaceable).map(v => normalizeConstraint(v, "user"));
  const unknown = asArray(input.constraints?.unknown).map(v => normalizeConstraint(v, "vision"));
  const room = ROOM_NOTES[input.roomType] || ROOM_NOTES.other;
  const preferredStyle = typeof input.stylePreference === "string" ? input.stylePreference : "designer-led";
  const userBrief = typeof input.userBrief === "string" ? input.userBrief.trim() : "";

  return {
    schema_version: "1.0.0",
    input: {
      source_image_id: input.sourceImageId,
      source_image_immutable: true,
      user_brief: userBrief,
      reference_image_ids: asArray(input.referenceImageIds)
    },
    room: {
      room_type: ROOM_NOTES[input.roomType] ? input.roomType : "other",
      intended_use: typeof input.intendedUse === "string" && input.intendedUse.trim()
        ? input.intendedUse.trim()
        : room.functions.join(", "),
      ...(input.dimensions ? {
        dimensions: {
          ...(Number.isFinite(input.dimensions.lengthM) ? { length_m: input.dimensions.lengthM } : {}),
          ...(Number.isFinite(input.dimensions.widthM) ? { width_m: input.dimensions.widthM } : {}),
          ...(Number.isFinite(input.dimensions.heightM) ? { height_m: input.dimensions.heightM } : {}),
          measurement_status: input.dimensions.measurementStatus || "unknown"
        }
      } : {}),
      geometry_observations: asArray(input.geometryObservations)
    },
    constraints: { fixed, preserve, replaceable, unknown },
    design_concept: {
      concept_id: `${archetype.id}-${index + 1}`,
      concept_name: archetype.name,
      design_thesis: archetype.thesis,
      style: preferredStyle === "designer-led" ? archetype.name : `${preferredStyle} / ${archetype.name}`,
      layout: {
        strategy: archetype.layout,
        functional_zones: room.functions,
        circulation_rule: "Preserve observed openings and verified clearances; flag uncertain dimensions instead of guessing.",
        architectural_change_policy: "Do not move or remove fixed/preserved elements."
      },
      materials: archetype.materials.map((material, i) => ({ role: ["primary", "secondary", "accent"][i] || "detail", direction: material })),
      lighting: archetype.lighting.map((direction, i) => ({ layer: i === 0 ? "primary" : "secondary", direction })),
      color_palette: archetype.palette,
      furniture: archetype.furniture.map(item => ({ direction: item, placement_rule: "Fit only after checking actual clearances and openings." })),
      decor: archetype.decor.map(item => ({ direction: item })),
      functional_rationale: room.checks,
      distinctiveness_tags: archetype.tags
    },
    render_requirements: [
      "Create a substantial new interior design, not a recolour of the existing room.",
      "Treat the source photograph as the immutable visual reference for the room's architecture.",
      "Respect every fixed and preserved constraint; do not invent dimensions.",
      "Only redesign elements explicitly replaceable or not constrained by the user.",
      "Produce a photorealistic architectural interior image with coherent materials, lighting and construction details.",
      "Do not add impossible furniture, obstruct doors, windows, appliances or required circulation."
    ],
    quality_checks: [
      { check_id: "geometry-fixed", severity: "critical", description: "No movement, removal or deformation of fixed architectural elements." },
      { check_id: "room-function", severity: "critical", description: "The result remains a usable " + input.roomType + " with its required functions." },
      { check_id: "concept-distinctness", severity: "major", description: "This concept must differ materially from the other two in composition, materials and design thesis." },
      { check_id: "style-fidelity", severity: "major", description: "The image must visibly express the selected design direction." },
      { check_id: "photorealism", severity: "major", description: "Materials, lighting, perspective and construction must be physically plausible." }
    ]
  };
}

/**
 * Return three distinct structured design briefs.
 * @param {{sourceImageId:string, roomType:string, userBrief?:string, stylePreference?:string,
 * dimensions?:object, constraints?:object, geometryObservations?:object[], intendedUse?:string}} input
 */
export function createDesignConcepts(input) {
  assertInput(input);
  return ARCHETYPES.map((archetype, index) => buildConcept(input, archetype, index));
}

/** Lightweight guard before any model adapter is called. */
export function validateConceptSet(concepts) {
  const errors = [];
  if (!Array.isArray(concepts) || concepts.length !== 3) {
    return { valid: false, errors: ["Exactly three concepts are required."] };
  }
  const ids = new Set();
  const signatures = new Set();
  for (const concept of concepts) {
    const dc = concept?.design_concept;
    if (!dc?.concept_id || !dc?.design_thesis || !dc?.layout || !Array.isArray(dc.materials)) {
      errors.push("A concept is missing required structured design fields.");
      continue;
    }
    if (ids.has(dc.concept_id)) errors.push("Concept IDs must be unique.");
    ids.add(dc.concept_id);
    const signature = [dc.design_thesis, ...(dc.color_palette || []), ...(dc.distinctiveness_tags || [])].join("|");
    if (signatures.has(signature)) errors.push("Concepts are duplicated; cosmetic variants do not count.");
    signatures.add(signature);
    if (concept.input?.source_image_immutable !== true) errors.push("The source image must remain immutable.");
  }
  if (new Set(concepts.map(c => c.design_concept?.concept_name)).size !== 3) {
    errors.push("All three concepts must have different design directions.");
  }
  return { valid: errors.length === 0, errors };
}
