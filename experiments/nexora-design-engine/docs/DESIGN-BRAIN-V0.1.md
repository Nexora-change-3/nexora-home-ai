# Design Brain v0.1 — implementation notes

## Implemented

`src/design-brain/concept-planner.mjs` is a deterministic first implementation of the concept-planning boundary. It returns three structured Design Brief objects for distinct strategies:
- Architectural clarity;
- Warm natural living;
- Expressive contemporary.

It is deliberately provider-neutral and has no network calls, API keys, image generation or external dependencies.

## Safety and correctness behavior

- Requires a source image ID; it never fabricates a replacement image.
- Marks the source image immutable in every concept.
- Separates fixed, preserved, replaceable and unknown constraints.
- Does not infer room dimensions from a photograph.
- Rejects invalid verified dimensions.
- Includes room-specific functional checks.
- Creates different material, palette, lighting, furniture and decor directions.
- Provides a lightweight three-concept validator before rendering.

## Deliberate limitations

This is a deterministic planning scaffold, not yet an AI designer. It does not inspect pixels, identify objects, calculate ergonomic clearances, infer floor plans, call an LLM or render images. It must not be presented as a finished interior design engine. Next work is to add a vision adapter that reports confidence and uncertainty, then a design-reasoning adapter that enriches these archetypes while preserving hard constraints.

## Run tests

From the repository root:

```bash
node --test experiments/nexora-design-engine/tests/concept-planner.test.mjs
```
