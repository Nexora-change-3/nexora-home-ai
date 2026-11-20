# Real-kitchen generator evaluation baseline

Date: 2026-11-20
Project: NEXORA Design Engine 1.4.0 experiment
Evaluation type: qualitative visual review of one source kitchen and four external generator outputs. This is not a pixel-level or measured geometry benchmark.

## Reference set

- Source kitchen, IMG-1421: https://ibb.co/h1MKv0sq
- DecAI IMG-1449: https://ibb.co/Kt1m5yT
- DecAI IMG-1450: https://ibb.co/kVsfkG51
- DecAI IMG-1447: https://ibb.co/Tx3HvhH7
- Houses AI IMG-1448: https://i.ibb.co/HpDrgRZj/IMG-1448.png

## Source-room evidence

The source is a real kitchen photographed from one viewpoint. Visible identity anchors include:
- the existing room envelope, camera viewpoint and perspective;
- the main cabinet/worktop run and the return counter on the right;
- the washing machine under the worktop;
- the oven and microwave on the left side;
- the sink and tap on the right part of the main run;
- existing upper cabinets, backsplash, floor and ceiling.

These are visible evidence anchors, not verified measurements. A single perspective image must not be used to infer exact room dimensions.

## Qualitative observations

### DecAI IMG-1449
- Retains the source viewpoint and most of the recognizable kitchen arrangement.
- Keeps the washing machine, oven, microwave and sink in broadly corresponding positions.
- Delivers a coherent light, contemporary finish with changed cabinet fronts, surfaces and lighting.
- Limitation: the result is closer to a high-quality finish refresh than a substantially new design.

### DecAI IMG-1450
- Produces a visually coherent, more ambitious composition with an island and dining area.
- The viewpoint, spatial composition and visible room features differ substantially from the source.
- The washing machine and several source identity anchors are absent.
- Limitation: high design novelty, weak evidence of preserving the actual room.

### DecAI IMG-1447
- Produces a restrained grey minimalist kitchen with a different composition and work-zone arrangement.
- The washing machine and several source identity anchors are absent; the image introduces a different-looking spatial arrangement.
- Limitation: it reads as a new kitchen inspired by the source rather than a reliable edit of the same room.

### Houses AI IMG-1448
- Retains a recognizable version of the source viewpoint and kitchen arrangement.
- The washing machine, oven, microwave and sink remain visible in broadly corresponding positions.
- Introduces a darker cabinet scheme, tiled backsplash, warm lighting and a more strongly styled atmosphere.
- Limitation: it is still primarily a cabinetry/finish refresh; it does not establish a substantially different functional design.

## Evaluation conclusion

The strongest structural references in this sample are DecAI IMG-1449 and Houses AI IMG-1448. The most visually ambitious alternatives are DecAI IMG-1450 and IMG-1447, but they do not provide convincing evidence that the original room was preserved.

NEXORA must not optimize for either extreme alone. The target is a substantial designer-led redesign of the same real room.

## Required NEXORA acceptance criteria

1. **Room-shell fidelity (critical):** retain the source walls, ceiling, openings, room envelope, camera viewpoint and perspective. Do not invent windows, doors, extensions or additional room volume.
2. **Fixed-element fidelity (critical):** preserve visible fixed services and appliances unless the user explicitly authorizes a change. In this reference, the washing machine, oven, microwave and sink are identity anchors that must not silently disappear or relocate.
3. **Functional coherence (critical):** retain plausible work zones, access, circulation and appliance clearances. Do not create an island or dining zone unless the source evidence and verified dimensions support it.
4. **Meaningful redesign (major):** each concept must change several meaningful, explicitly replaceable design elements. A palette or cabinet-colour change alone is not a redesign.
5. **Concept diversity (major):** the three concepts must differ in design thesis, material hierarchy, cabinet/furniture language, lighting and focal point—not merely in colour.
6. **Photorealism (major):** require plausible construction, material scale, lighting, reflections and perspective.
7. **Evidence and uncertainty:** record visible observations, confidence and occlusion. Do not present inferred dimensions as measurements. Unknown elements are not permission to remove them.

## Implementation gap identified in release candidate 1.4.0

The current live post-render check in `worker.mjs` calls `verifyRoomIdentity`, which checks the room category (for example, kitchen versus living room). The deterministic quality scorer in `src/quality-gate/quality-gate.mjs` is not pixel-aware and is not wired into the live render path. Therefore, current automated checks do not yet establish room-shell fidelity, appliance preservation, functional layout or visual redesign strength.

Before production promotion, add and test a separate evidence-based visual comparison stage for source versus candidate. It must fail closed on critical uncertainty or detected changes to protected anchors, and must not claim verified geometry from a single image. Keep release 1.2.1 and V1/V2 untouched until real inference and visual evaluation pass.
