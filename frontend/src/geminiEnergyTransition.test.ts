import assert from "node:assert/strict";
import test from "node:test";
import { GeminiEnergyTransitionGate } from "./geminiEnergyTransition.ts";

test("requires sustained energy and three contributors before moving high", () => {
  const gate = new GeminiEnergyTransitionGate();
  assert.equal(gate.observe({ energy: .9, activeClients: 2, nowMilliseconds: 0 }), undefined);
  assert.equal(gate.observe({ energy: .9, activeClients: 3, nowMilliseconds: 1_000 }), undefined);
  assert.equal(gate.observe({ energy: .9, activeClients: 3, nowMilliseconds: 5_499 }), undefined);
  assert.equal(gate.observe({ energy: .9, activeClients: 3, nowMilliseconds: 5_500 }), "high");
});

test("uses a longer dwell and cooldown before moving back low", () => {
  const gate = new GeminiEnergyTransitionGate();
  gate.setCurrentTier("high");
  assert.equal(gate.observe({ energy: .5, activeClients: 3, nowMilliseconds: 0 }), undefined);
  assert.equal(gate.observe({ energy: .5, activeClients: 3, nowMilliseconds: 6_999 }), undefined);
  assert.equal(gate.observe({ energy: .5, activeClients: 3, nowMilliseconds: 7_000 }), "low");
  assert.equal(gate.observe({ energy: .9, activeClients: 3, nowMilliseconds: 8_000 }), undefined);
  assert.equal(gate.observe({ energy: .9, activeClients: 3, nowMilliseconds: 53_000 }), "high");
});
