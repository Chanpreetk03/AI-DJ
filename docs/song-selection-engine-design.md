# Music Selection Engine Design

Status: Design before implementation

## Goal

Support two ways to choose music without replacing the current local AI-DJ engine:

1. Manual choice: the host searches, distinguishes candidates, and chooses the exact track/version.
2. Automatic choice: the host configures preferences and the engine chooses the next eligible track from curated Spotify sources according to Room State, language, remix preference, and history.

The engine chooses a Track Candidate. A separate playback Adapter is responsible for asking Spotify or the local audio engine to play it.

## Key decision: language is explicit

Spotify search results provide title, artist, album, dates, duration, explicit status, playability, and identifiers, but not a dependable language field. Therefore the engine must not silently guess language from a title or feed Spotify Content into an AI language classifier.

Language enters the system through one of these host-controlled sources:

- a language-specific playlist, such as `Punjabi`, `Hindi`, `English`, or `Mixed`;
- a host-assigned Track Profile after a search result is selected;
- a future import file that maps Spotify track URIs to language tags.

If the requested language has no eligible candidates, the host chooses the fallback: stay in the language, use `Mixed`, or ask for confirmation before changing language.

## Domain model

```text
Track Candidate
  provider: spotify | local
  providerId / uri
  title
  artists
  album
  releaseDate
  duration
  explicit
  playable

Track Profile
  trackUri
  languageTags[]
  energyBand: calm | warm | groove | active | peak
  variantType: original | remix | edit | extended | live | instrumental
  hostTags[]
  lastPlayedAt
  playCount
  artistCooldownUntil

Selection Request
  mode: manual | automatic
  roomEnergy
  roomTrend
  preferredLanguages[]
  languageFallback: strict | mixed | ask
  remixPreference: avoid | allow | prefer
  explicitPolicy: allow | avoid | block
  sourceScope: selectedTracks | playlistLanes | hostLibrary
  currentTrackUri

Selection Decision
  candidate
  confidence: low | medium | high
  reason[]
  requiresConfirmation
```

## Deep module and seam

The `MusicSelectionEngine` is the deep module. Its interface should remain provider-neutral and small:

```ts
interface MusicSelectionEngine {
  selectNext(request: SelectionRequest, candidates: TrackCandidate[], profiles: TrackProfile[]): SelectionDecision;
}
```

The implementation hides eligibility, scoring, diversity, cooldowns, fallback language behavior, remix handling, and explanation generation. Callers do not implement their own ranking rules.

Provider adapters sit outside this seam:

- `SpotifyCatalogAdapter`: search tracks, load selected playlist items, and return Track Candidates.
- `LocalCatalogAdapter`: expose the existing bundled/stem library as Track Candidates.
- `SpotifyPlaybackAdapter`: play the chosen Spotify URI through Spotify's official player.
- `LocalPlaybackAdapter`: play the chosen local track through `RealMusicDecks`.

This keeps the current local engine intact and makes Apple Music a future Catalog/Playback Adapter rather than a rewrite of selection logic.

## Candidate pipeline

### 1. Normalize

Normalize only metadata used for matching:

- trim whitespace;
- case-fold title and artist comparisons;
- preserve the original title and URI for display/playback;
- keep remix suffixes instead of removing them.

### 2. Apply hard eligibility rules

Reject candidates that are:

- unavailable or unplayable;
- blocked by the explicit-content policy;
- outside the selected source scope;
- outside a strict language preference;
- the current track when a different track is required;
- inside artist or track cooldown;
- already played too recently.

If no candidates remain, return a low-confidence decision with an explanation instead of silently violating a hard rule.

### 3. Score eligible candidates

Use deterministic, explainable scoring:

```text
score =
  languageMatch       * 35
  + energyBandFit     * 25
  + remixFit          * 15
  + freshness         * 10
  + artistDiversity   * 10
  + hostPreference    * 5
```

The score is not a machine-learning model and does not analyze protected Spotify audio. It uses host-curated profiles, provider metadata, Room State, and playback history.

### 4. Apply diversity constraints

Do not repeat the same track until a configurable history window has passed. Avoid repeating the same artist back-to-back unless the host explicitly chooses a single-artist source. Prefer a different variant when the host has asked for remix variety.

### 5. Explain and confirm

Every automatic decision exposes a short reason, for example:

```text
Peak energy · Punjabi preference · remix preferred · artist cooldown satisfied
```

Manual search always requires a host click. Automatic mode can play high-confidence decisions automatically; low-confidence language fallbacks require host confirmation.

## Manual selection flow

1. Host enters a song or artist query.
2. Spotify Catalog Adapter returns Track Candidates.
3. UI displays title, artist, album, release year, duration, explicit status, playability, and variant hints from the original title.
4. Host selects one candidate.
5. The selected URI is played through the provider Playback Adapter.
6. The host may optionally assign or edit its Track Profile for future automatic choices.

This resolves duplicate names by identity and context, not by guessing. `Song`, `Song (Remix)`, and a cover on another album remain distinct candidates.

## Automatic vibe and language flow

The first automatic version should use playlist lanes, because language and remix intent are explicit and reviewable:

```text
Language: Punjabi
  calm/warm   -> Punjabi warm-up playlist
  groove      -> Punjabi groove playlist
  active      -> Punjabi active playlist
  peak        -> Punjabi peak/remix playlist

Language: English
  calm/warm   -> English warm-up playlist
  groove      -> English groove playlist
  active      -> English active playlist
  peak        -> English peak/remix playlist
```

The host can configure one language, several allowed languages, or mixed-language mode. Room energy selects a target energy band; hysteresis prevents oscillation near thresholds; a minimum dwell or next-track boundary prevents frantic changes.

Suggested defaults:

- energy band hysteresis: 0.10;
- do not change lane more often than once per track or 45 seconds;
- queue one or two candidates ahead;
- preserve the current track unless the host explicitly enables emergency recovery;
- use the Peak/Remix lane for remixes instead of guessing from audio.

## Remix handling

Remixes are first-class Track Candidates. The engine should:

- preserve Spotify's original title and URI;
- show remix/edit/extended/live text exactly as returned;
- allow `avoid`, `allow`, and `prefer` remix policies;
- support a dedicated Remix playlist or Track Profile tag;
- prevent the original and its remix from being selected back-to-back unless requested;
- never attempt to create a remix from a Spotify recording.

## Failure and fallback behavior

- Spotify disconnected: continue local AI-DJ playback or show a host action to reconnect.
- Search returns no result: show a clear message and preserve the current track.
- No language match: apply the configured `strict`, `mixed`, or `ask` fallback.
- Track unavailable: skip it before playback and explain why.
- Provider playback fails: keep the local engine available.
- Room energy fluctuates: hold the current lane until hysteresis and dwell rules are satisfied.

## Implementation order

1. Extract provider-neutral Track Candidate, Track Profile, Selection Request, and Selection Decision types.
2. Move current search results into `SpotifyCatalogAdapter`.
3. Add a deterministic `MusicSelectionEngine` with unit tests for duplicate titles, language fallback, energy bands, remix preference, cooldowns, and no-candidate behavior.
4. Add host controls for language, remix preference, explicit policy, and manual/automatic mode.
5. Add playlist-lane configuration using Spotify playlist URIs.
6. Add automatic queue decisions at track boundaries with hysteresis.
7. Add local playback fallback and status explanations.
8. Add Apple Music adapters later without changing the engine.

## Design constraints

Spotify's official Search API supports metadata search and field filters, but Spotify policy prohibits using Spotify Content to train AI models and explicitly calls out DJ/mixing and synchronization restrictions. The engine therefore makes metadata- and host-curation-based decisions and delegates playback to the official provider player.

Sources:

- [Spotify Search for Item](https://developer.spotify.com/documentation/web-api/reference/search)
- [Spotify compliance tips](https://developer.spotify.com/compliance-tips)
