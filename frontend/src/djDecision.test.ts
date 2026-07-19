import assert from "node:assert/strict";
import test from "node:test";
import { decideTrack, type DecisionCandidate } from "./djDecision.ts";

const profile = {
  bpm: 120,
  bpmConfidence: 0.9,
  durationSeconds: 64,
  phraseSeconds: 16,
  loudness: 0.6,
  dynamics: 0.6,
  brightness: 0.6,
  rhythmicity: 0.8,
  intensity: 0.8,
  sections: [{ id: "phrase-1", startSeconds: 0, endSeconds: 16, loudness: 0.6, intensity: 0.8, safeTransition: true }],
};

const candidates: DecisionCandidate[] = [
  { id: "glitch-stairs", title: "Glitch Stairs", key: "D minor", profile },
  { id: "rhythm-factory", title: "Rhythm Factory", key: "D minor", profile },
];

test("chooses a compatible fresh track when a material crowd shift requests variety", () => {
  const decision = decideTrack(
    { label: "peak", intensity: 0.9, rhythmicDemand: 0.85, stability: 0.6, confidence: 0.9, trend: 0.3 },
    candidates,
    ["glitch-stairs"],
    "glitch-stairs",
    "D minor",
    120,
    {},
    true,
  );

  assert.equal(decision.trackId, "rhythm-factory");
});
