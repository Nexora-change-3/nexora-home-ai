# Vision boundary and constraint ledger

## Vision Analysis contract

A vision model may report visible objects, surfaces, openings, confidence and uncertainty. It cannot turn a single perspective photograph into verified room dimensions. Dimension hypotheses must be explicitly labelled `vision_estimated`.

## Constraint resolution

`src/constraints/resolve-constraints.mjs` resolves conflicting instructions by strict priority:
1. explicit user instruction;
2. verified measurement;
3. vision hypothesis.

A visual detection never grants permission to remove or relocate an element. Any unresolved/unknown constraint or conflict sets `requires_review`.

## Why this matters

The system must not confuse "the model thinks this is a cabinet" with "the user allows us to replace it", or "the model estimates 3.2 m" with "the wall is measured at 3.2 m". These are different types of evidence and must remain different in the data model.
