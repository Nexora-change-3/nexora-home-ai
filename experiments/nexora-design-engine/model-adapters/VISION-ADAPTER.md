# Vision Adapter Boundary v0.1

A provider adapter exposes `provider`, `modelId`, optional `modelVersion`, and an async `analyze({ image, context })` method. The image payload is the identified original: `{ sourceImageId, contentType, bytes: Uint8Array }`.

Use `analyzeRoomPhoto({ adapter, sourceImage, context })` from `src/vision/analyze-room-photo.mjs`. The boundary accepts JPEG/PNG/WebP, copies the original bytes before passing them to a provider, verifies that the result belongs to the same source image, validates observation categories/confidence/visibility/normalized regions, and preserves model provenance.

Any dimension inferred from a photograph must remain `vision_estimated`; it is not a verified measurement. Low-confidence, partially visible, occluded, ambiguous, or dimension-derived observations trigger human review. Vision observations are evidence only and never authorize moving or replacing architectural elements; the constraint resolver remains authoritative.

**Status:** this is a provider-neutral integration boundary and validator, not a connected vision model. No image pixels are analysed until a concrete provider adapter is implemented and called with the user's original photograph. No substitute image is used.
