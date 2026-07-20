import assert from "node:assert/strict";
import test from "node:test";
import { countdownSeconds, fullDropVibrationPattern, localizeCrowdDropCountdown } from "./crowdDrop.ts";

test("Crowd Drop countdown starts at three and reaches zero without a placeholder", () => {
  const now = 100_000;

  assert.equal(countdownSeconds(now + 3_000, now), 3);
  assert.equal(countdownSeconds(now + 1, now), 1);
  assert.equal(countdownSeconds(now, now), 0);
});

test("Crowd Drop uses its received duration instead of a remote wall clock", () => {
  const local = localizeCrowdDropCountdown({ countdownEndsAtMilliseconds: 1, countdownDurationMilliseconds: 3_000 }, 200_000);

  assert.equal(countdownSeconds(local.countdownEndsAtMilliseconds, 200_000), 3);
});

test("Crowd Drop vibration pattern spans the visual burst", () => {
  assert.equal(fullDropVibrationPattern().reduce((total, value) => total + value, 0), 8_000);
});
