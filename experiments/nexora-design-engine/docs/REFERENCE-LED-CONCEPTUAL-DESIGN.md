# NEXORA product direction: reference-led conceptual interior design

Status: Product direction approved for the isolated design-engine experiment
Date: 2026-11-20

## Core product decision

NEXORA is not a recolouring tool, a decor restyler, or a wrapper around any one image generator. DecAI and Houses AI are external comparison samples only. Their outputs are neither the product's design foundation nor gold-standard targets.

The product must generate a genuinely new, coherent interior-design concept for the user's actual room, guided by a selected style, mood, designer brief, or visual reference.

A successful result is not "the same room with different cabinet colours and accessories". It should read as a new designer-authored concept while remaining a plausible transformation of the same real space.

## Two independent inputs: room evidence and design intent

### 1. Room evidence (what must be designed)

Analyze the original photo(s) to identify:
- room envelope, visible walls, ceiling, floor, openings and camera perspective;
- fixed services, plumbing, electrical points and immovable/unknown elements;
- appliances, furniture, storage, circulation and functional zones;
- occlusions, uncertainty and what cannot be established from the available views.

Keep observed facts, inferred hypotheses and verified measurements separate. A single photo is not a source of exact dimensions or unseen geometry.

### 2. Design intent (what the new concept should express)

Accept one or more of:
- named interior style or design movement;
- one or more user-supplied visual references;
- mood, atmosphere, material character or desired level of boldness;
- practical brief and explicit likes/dislikes.

Interpret references as a design language, not as a template to copy. Extract the underlying principles: massing, proportion, cabinet language, material hierarchy, rhythm, contrast, lighting, focal composition, furniture vocabulary and detail level. Translate those principles to the actual room.

If the user supplies no style, do not force a fixed trio of hard-coded styles. Develop distinct, coherent designer-led directions from the brief and room evidence, and make the rationale explicit.

## The design process

1. **Read the room:** build a room-evidence model with visible geometry, openings, fixed services, appliances, existing functional zones, viewpoint and uncertainty.
2. **Read the design intent:** identify the style's defining principles and reference-specific features. Separate essential style DNA from incidental objects, staging and camera differences.
3. **Build a transformation strategy:** decide what is preserved, redesigned, relocated only when authorized and dimensionally supported, or left unresolved pending user confirmation.
4. **Design at composition level:** create a new spatial and visual hierarchy, not just a surface treatment. Consider cabinet architecture, storage volumes, worktop and backsplash treatment, island/peninsula only if physically supported, furniture, lighting architecture, material transitions and focal point.
5. **Create distinct concepts:** each concept must have a distinct design thesis and a materially different composition/material/furniture/lighting strategy. Three colour variants of one layout are not three concepts.
6. **Render from the original:** use the original photo as the image-edit anchor. Do not render from a previous generated result as the new source. Keep camera viewpoint and room shell stable unless the user explicitly requests a different view or a verified redesign.
7. **Evaluate the actual output:** compare source and candidate for room identity, geometry, fixed elements, functional plausibility, reference/style fidelity, depth of redesign, photorealism and concept distinctness. Reject accessory-only or recolour-only results.

## Transformation permissions

Use an explicit per-element ledger:
- **fixed:** cannot change or move;
- **preserve:** retain, though compatible finishes may be redesigned if allowed;
- **replaceable:** may be substantially redesigned;
- **relocatable:** may move only with explicit user authorization and sufficient measurements/technical evidence;
- **unknown:** do not assume permission; request confirmation or keep unchanged.

Do not equate "not detected" with "not present". A partly hidden appliance, opening or service is not permission to erase it.

Room geometry preservation does not mean preserving the old interior design. NEXORA should be ambitious about replaceable design elements while conservative about unsupported architectural or technical changes.

## What counts as a meaningful redesign

A concept should change several major design dimensions where the room and permissions allow, such as:
- cabinet/front architecture and overall joinery composition;
- storage massing and integration strategy;
- worktop, backsplash and material junctions;
- island/peninsula or other functional furniture, only when dimensionally plausible;
- lighting architecture and layered lighting;
- furniture forms and spatial hierarchy;
- coherent material palette, texture and detail language.

Changing only colour, handles, backsplash tone, small accessories or plants is a cosmetic refresh and must not pass as a new concept.

## Style/reference fidelity

A reference-led concept must explain:
- which defining design principles were extracted from the reference;
- how each principle is adapted to the user's room;
- which reference details are intentionally not copied and why;
- which major design decisions make the result recognizably express the requested style.

Do not claim exact imitation of a designer, project or reference if the result only shares a broad mood. Prefer describing the transferable design language.

## Concept diversity

When producing three concepts, diversify the design thesis, composition, joinery language, material hierarchy, lighting and focal point. Do not use a fixed universal trio for every room. Concepts must be conditioned on the user's selected style/reference and the actual room.

If the user asks for one specific style, the three outputs may be three different interpretations within that style (for example, restrained, expressive and warmer/material-led), rather than unrelated styles that ignore the brief.

## Quality gate: reject the wrong kind of success

Critical rejection:
- room shell, openings or perspective visibly distorted without authorization;
- fixed services or required appliances disappear or move without permission;
- implausible circulation, clearances or construction;
- candidate no longer depicts the same room;
- image is generated from the wrong source.

Major rejection:
- result is mostly recolouring, new handles, accessories or staging;
- requested style/reference is not clearly expressed;
- concepts are cosmetic variations of one another;
- major design choices ignore the room evidence or user's brief.

Quality scoring must keep separate axes for:
1. room identity and geometry;
2. functional/technical plausibility;
3. depth of conceptual redesign;
4. style/reference fidelity;
5. material and composition quality;
6. photorealism;
7. diversity between concepts.

Do not allow a high style score to compensate for a critical geometry failure, or a high geometry score to disguise a cosmetic-only result.

## Role of external generators

Use DecAI, Houses AI and any future tools as a broad competitive test set. Add other generators and reference-led workflows when useful. Compare them on the same original image and brief, but do not train NEXORA's product definition around their strengths or limitations. The objective is an independent design process and provider-neutral rendering architecture.

## Current implementation implications

The current experiment already contains:
- a vision observation pipeline;
- a constraint ledger;
- an AI Design Brain prompt and response validator;
- a deterministic concept planner with fixed archetypes;
- a structured quality scorer that currently requires supplied review evidence and does not inspect pixels.

The next engineering work should therefore:
1. replace the assumption of a universal hard-coded concept trio with brief- and reference-conditioned concept synthesis;
2. formalize the reference interpretation and transformation map in the concept schema;
3. distinguish preserved geometry from redesignable interior architecture and from relocations requiring measurement/authorization;
4. require a minimum level of major design transformation, not merely three replace-list entries;
5. add a real source-versus-candidate visual evaluation stage before any production promotion.

This document defines product direction; it does not claim these engineering capabilities are already implemented. Production must remain unchanged until implementation, automated tests, real-image evaluation and deployment checks pass.
