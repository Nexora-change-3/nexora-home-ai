import test from "node:test";
import assert from "node:assert/strict";
import { verifyRoomIdentity } from "../src/quality-gate/room-identity-gate.mjs";

test("visual review prompt explicitly requires major design move statuses", async () => {
  const moves = ["replace cabinet architecture", "recompose storage wall", "introduce layered lighting architecture"];
  let candidateQuestion = "";
  const review = {
    room_type: "kitchen",
    preservation_checks: [],
    major_design_moves: moves.map(move => ({ move, status: "implemented", confidence: 0.95, evidence: "Clearly visible" })),
    redesign_assessment: { composition_level_changes: 3, cosmetic_only: false, implemented_major_moves: moves, missing_major_moves: [] },
    reference_fidelity_score: 0.9,
    functional_plausibility_score: 0.9,
    photorealism_score: 0.9,
    critical_findings: [],
    uncertainties: []
  };
  const AI = { run: async (_model, args) => {
    if (args.question.startsWith("Reply with exactly one room label")) return { answer: "kitchen" };
    candidateQuestion = args.question;
    return { answer: JSON.stringify(review) };
  }};
  const result = await verifyRoomIdentity({
    AI,
    sourceImage: { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png", roomType: "kitchen" },
    candidateImage: { bytes: new Uint8Array([4, 5, 6]), contentType: "image/png" },
    expectedRoomType: "kitchen",
    qualityContext: { source_observations: [], constraints: { fixed: [], preserve: [], unknown: [] }, design_thesis: "A substantial kitchen redesign", style_preference: "modern", major_design_moves: moves }
  });
  assert.match(candidateQuestion, /keys: room_type, preservation_checks, major_design_moves, redesign_assessment/);
  assert.equal(result.accepted, true);
  assert.equal(result.visual_review.review_required, false);
});
