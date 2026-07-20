import assert from "node:assert/strict";
import test from "node:test";
import { hasSpotifyAuthorizationCallback } from "./spotifyPlayback.ts";

test("Spotify callback URL resumes authorization after the provider redirect", () => {
  assert.equal(hasSpotifyAuthorizationCallback("?code=spotify-code&state=expected-state"), true);
  assert.equal(hasSpotifyAuthorizationCallback("?code=spotify-code"), false);
  assert.equal(hasSpotifyAuthorizationCallback("?state=expected-state"), false);
});
