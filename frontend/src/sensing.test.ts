import assert from "node:assert/strict";
import test from "node:test";
import { inferCrowdIntent } from "./djIntent.ts";
import { combineMotionSignals } from "./sensing.ts";

test("amplifies deliberate camera movement for a single participating phone", () => {
  assert.ok(combineMotionSignals(0.1, 0) >= 0.2);
});

test("recognizes a sustained one-phone motion signal as groove intent", () => {
  const intent = inferCrowdIntent({
    energy: 0.22,
    coherence: 0.9,
    activeClients: 1,
    motionEnergy: 0.42,
    audioEnergy: 0.1,
    onsetDensity: 0.1,
    energyTrend: 0,
    volatility: 0.08,
    confidence: 0.7,
  });

  assert.equal(intent.label, "groove");
});
