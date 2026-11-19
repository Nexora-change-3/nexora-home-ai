# Quality Gate v0.1

Implemented as a deterministic policy layer, not as computer vision.

- Weighted criteria are encoded in `src/quality-gate/quality-gate.mjs`.
- A candidate must reach 3.5/5 weighted score to pass.
- Any critical finding blocks acceptance regardless of score.
- A fixed-geometry change, broken room function, impossible/unsafe layout or source-image mismatch blocks acceptance.
- The gate requires complete 0–5 scores; missing or invalid scores are rejected.
- Three-concept diversity checks thesis, materials, palette and tags before rendering.

Important limitation: this module does not inspect rendered pixels. A future vision evaluator and human reviewer must supply evidence. Never describe this gate as automatic geometry verification until that capability is implemented and validated on real photographs.
