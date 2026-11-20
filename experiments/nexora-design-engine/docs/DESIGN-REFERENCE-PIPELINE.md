# NEXORA — Visual Design Reference Pipeline

Status: implemented on `experiment/nexora-design-engine`; not deployed to production.

## Purpose

A reference image is an optional source of design intent. It is not a second room to copy and it is not evidence about the geometry of the user's room.

NEXORA now accepts two separate images:

1. **Source room photo** — evidence for room identity, visible architecture, openings, appliances, surfaces, fixed services, viewpoint and uncertainty.
2. **Design reference photo** — evidence only for transferable visual language: proportions, rhythm, material hierarchy, contrast, joinery language, lighting, composition and colour relationships.

## Processing flow

1. The browser keeps both original files locally and sends them only after the user gives external-processing consent.
2. The Worker validates each file independently (JPEG/PNG/WebP, maximum 8 MB) and calculates a separate SHA-256 identifier.
3. Moondream analyzes the source room with the existing cautious room-analysis prompt.
4. If a reference was supplied, Moondream receives a separate reference-specific prompt. It must return a structured design-language analysis and must not infer room dimensions, openings, services, room type or permission to change the source room.
5. The reference analysis is validated against a fixed schema before it reaches the Design Brain.
6. The Design Brain receives the room evidence, constraint ledger, user brief/style and reference principles. It translates principles to the source room rather than copying the reference composition literally.
7. Three concepts are generated for the same source room. If a style was selected, all three remain within that style while varying their design interpretation.
8. The browser shows the extracted design-language summary so the user can see what NEXORA understood from the reference.
9. Rendering uses the source room photo and the resulting design brief. The reference photo itself is not passed as the render source.
10. Before saving a rendered result, Moondream checks room identity and performs a structured review against the source observations, fixed/preserved constraints, major design moves and reference principles. Clear fixed-element changes and cosmetic-only outputs are rejected; incomplete evidence is marked for review.

## Non-negotiable boundaries

- The reference image never changes the source room's geometry or camera evidence.
- A reference cannot authorize moving/removing walls, openings, appliances, plumbing or fixed services.
- Unknown source-room elements remain unknown; they are not replaceable by implication.
- Reference-room objects, layout, openings and proportions must not be copied literally.
- Source and reference image bytes are not persisted in D1. Structured room observations, constraints, reference design-language analysis and concept instructions are temporarily stored together in the design session (24-hour TTL) so the post-render reviewer can compare the candidate with the original evidence. Rendered images remain under the existing temporary result-storage policy.
- A missing reference is valid. The existing style/brief-driven flow continues without a reference-analysis call.

## Current limitations

- One optional reference image is supported per design session.
- The vision model's interpretation is probabilistic and must be reviewed; it is not a material specification or measured drawing.
- The post-render review is model-assisted and evidence-conditioned, not pixel registration or a geometric diff. It can miss subtle spatial changes and must not be represented as a measured guarantee. Ambiguous checks are marked for review rather than silently passed.
- The Worker route and adapter are provider-injected at the Design Brain boundary, but this reference implementation currently uses the configured Cloudflare Workers AI Moondream adapter.

## Verification

Covered by unit and integration tests for:
- required reference-analysis fields and image-ID matching;
- a dedicated reference prompt that explicitly rejects geometry inference;
- passing extracted principles into the Design Brain prompt;
- optional reference upload through `/api/concepts`;
- preserving the source-image identity and existing room-analysis path;
- browser consent visibility before analysis and safe rendering of the returned summary.
