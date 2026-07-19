import assert from "node:assert/strict";
import test from "node:test";
import { MusicSelectionEngine, type TrackCandidate, type TrackProfile, type SelectionRequest } from "./musicSelection.ts";

const engine = new MusicSelectionEngine();

function request(overrides: Partial<SelectionRequest> = {}): SelectionRequest {
  return {
    mode: "automatic",
    roomEnergy: 0.5,
    preferredLanguages: [],
    languageFallback: "mixed",
    remixPreference: "allow",
    explicitPolicy: "allow",
    nowMilliseconds: 100_000,
    minimumReplayGapMilliseconds: 20_000,
    minimumArtistGapMilliseconds: 3_000,
    ...overrides,
  };
}

function candidate(uri: string, overrides: Partial<TrackCandidate> = {}): TrackCandidate {
  return { uri, provider: "spotify", title: uri, artists: [uri], album: "Album", releaseDate: "2026-01-01", durationMilliseconds: 180_000, explicit: false, isPlayable: true, ...overrides };
}

function profile(trackUri: string, overrides: Partial<TrackProfile> = {}): TrackProfile {
  return { trackUri, languageTags: [], energyBand: "groove", variantType: "original", hostTags: [], playCount: 0, ...overrides };
}

test("energy bands clamp values outside the room-energy range", () => {
  assert.equal(engine.energyBand(-1), "calm");
  assert.equal(engine.energyBand(0.79), "active");
  assert.equal(engine.energyBand(2), "peak");
});

test("manual selection returns the exact host-selected candidate", () => {
  const selected = candidate("spotify:track:selected");
  const decision = engine.selectNext(request({ mode: "manual", selectedTrackUri: selected.uri }), [candidate("spotify:track:other"), selected], []);

  assert.equal(decision.candidate?.uri, selected.uri);
  assert.equal(decision.confidence, "high");
  assert.equal(decision.requiresConfirmation, false);
});

test("selection excludes unplayable and recently played candidates", () => {
  const decision = engine.selectNext(request(), [
    candidate("spotify:track:unplayable", { isPlayable: false }),
    candidate("spotify:track:recent"),
  ], [profile("spotify:track:recent", { lastPlayedAt: 99_000 })]);

  assert.equal(decision.candidate, null);
  assert.equal(decision.requiresConfirmation, true);
});

test("strict language policy rejects candidates without a language match", () => {
  const decision = engine.selectNext(request({ preferredLanguages: ["Hindi"], languageFallback: "strict" }), [candidate("spotify:track:english")], [profile("spotify:track:english", { languageTags: ["English"] })]);

  assert.equal(decision.candidate, null);
  assert.deepEqual(decision.reason, ["No eligible track matches the current selection rules"]);
});

test("automatic selection prefers the candidate in the current energy band", () => {
  const decision = engine.selectNext(request({ roomEnergy: 0.9 }), [candidate("spotify:track:groove"), candidate("spotify:track:peak")], [
    profile("spotify:track:groove", { energyBand: "groove" }),
    profile("spotify:track:peak", { energyBand: "peak", hostTags: ["preferred"] }),
  ]);

  assert.equal(decision.candidate?.uri, "spotify:track:peak");
  assert.match(decision.reason.join(" "), /peak energy fit/);
});
