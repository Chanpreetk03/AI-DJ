# DJ AI Layer Research

Date: 2026-07-19

## Finding

The pulled local-music pipeline is already the core of an AI DJ, rather than a playlist player:

```text
RoomState -> CrowdIntentTracker -> decideTrack -> phrase-aligned crossfade -> feedback
```

It derives `warmup`, `groove`, `lift`, `peak`, and `recovery`; scores analysed music sections by intensity, tempo, rhythmicity, stability, key/BPM compatibility, novelty, and response feedback; then changes at a safe phrase boundary. This implements the essential DJ loop: observe the room, choose a direction, prepare a compatible next record, and transition without breaking flow.

The current provider modes do not yet share that loop. Spotify automatic mode searches for a vibe/language playlist and starts an individual result; YouTube Music remains manual selection. Neither provider is part of the local analyser, section scorer, or beat/phrase transition path.

## What a DJ contributes beyond playlist playback

1. **Reads the room over time.** A DJ responds to the collective floor, not one momentary signal, and avoids overreacting to minor movement. This maps to the existing confidence, coherence, volatility, trend, and intent hysteresis.
2. **Shapes an arc.** A DJ does not simply maximise energy; they hold a groove, build anticipation, release into recovery, and reserve peaks. The decision needs both current room state and a set-level memory.
3. **Prepares a small set of viable next moves.** They select the next track before the current one ends and preserve alternatives when the room changes.
4. **Makes transitions musically.** Beat/BPM, key compatibility, cue points, phrase timing, EQ/levels, and clean entrances are how a selection becomes a continuous set.
5. **Learns from the result.** A good transition that lifts the room should influence later choices; a drop in engagement should make the system more conservative.

Native Instruments describes beatmatching as synchronising BPM so two tracks can play together without disrupting flow, and notes that compatible key plus drum-led intros/outros make transitions safer. AlphaTheta likewise emphasises cue points, BPM matching, collection preparation, mixing, and stem control as the practical tools for smooth DJ transitions. [Native Instruments: Beatmatching](https://blog.native-instruments.com/beatmatching/) · [AlphaTheta: DJ guide](https://alphatheta.com/en/landing/dj-guide/)

## Recommendation: deterministic DJ core, Gemini as creative director

Use the current deterministic local pipeline as the **DJ core**. It owns real-time safety and must make the final selection from a bounded candidate set.

Gemini is useful, but only above that core:

```text
Host brief + current set summary + room intent
             |
             v
      Gemini creative direction
             |
             v
  structured constraint/objective JSON
             |
             v
 deterministic candidate filter + ranker + transition scheduler
```

Gemini can turn host language into a structured brief (for example, "Bollywood dance, familiar songs, build slowly, avoid explicit tracks, no same artist twice"), propose search queries, choose between a few safe musical directions, and explain the current plan. It should **not** choose an arbitrary URI, invent metadata, make every real-time decision, or receive raw camera/microphone data or protected streaming audio.

Gemini supports structured JSON output and function calling, which fits a constrained output such as `targetEnergyBand`, `allowedGenres`, `searchQueries`, `riskLevel`, and `reason`. The application still executes the catalog-search and playback functions and validates every result. [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output?lang=rest) · [Gemini function calling](https://ai.google.dev/gemini-api/docs/generate-content/function-calling?authuser=1&hl=en)

The Gemini API key must stay on the backend (environment variable / secret store), never in Vite client code. The browser should call a room-scoped backend endpoint that returns only a validated DJ directive.

## Do not web-scrape music platforms

Web scraping is the wrong catalog or playback strategy. It is brittle, bypasses the capabilities and policy limits of provider APIs, and cannot give the local engine rights to decode, stem-split, or beat-match protected streams. Use official provider APIs for search and official playback SDKs for playback.

Spotify's SDK reports player state changes, including track changes, so it can support an automatic *next-track* controller. It is still provider-controlled playback, not an audio source for the local mixer. [Spotify Web Playback SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference)

YouTube's IFrame API has queue/play controls and an `onStateChange` event with an `ENDED` state, so it can also trigger next-track selection. Embedded video availability and policy constraints still make it a weaker primary DJ source than an analysed, licensed local library. [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)

## Implementation direction

1. Repair the current frontend build before extending functionality. The current pulled source has duplicated declarations in `frontend/src/output.ts`, causing `npm run build` to fail.
2. Extract a `DjOrchestrator` from `output.ts`. It owns set memory, the current intent, a two-item queue, hold/skip state, and post-track feedback.
3. Add a provider-neutral `CatalogAdapter` and `PlaybackAdapter`. Spotify, YouTube, and local files return the same candidate shape; only the local adapter supports phrase-aligned audio mixing.
4. Add provider playback state callbacks. On track end (or a pre-end window), the orchestrator selects the next approved candidate; do not use a timer as the sole source of truth.
5. Add a backend `DjDirector` endpoint using Gemini structured output behind a feature flag. It produces a constrained direction, never direct playback commands. The deterministic ranker validates it against preferences, catalog metadata, cooldowns, and provider availability.
6. Start with local music as the full reactive DJ experience. Treat Spotify/YouTube as automatic selection and gapless hand-off experiments until their provider limitations have been evaluated for the intended deployment.

## Definition of done

- The DJ keeps at least two eligible next candidates ready.
- A stable crowd does not cause unnecessary track changes.
- Rising energy creates a controlled build; falling energy creates recovery rather than random escalation.
- A track cannot repeat within the configured history window, and artists have a cooldown.
- Every automatic decision has an inspectable explanation and a host override.
- Provider errors, unavailable tracks, and API failures leave the current audio playing or fall back safely to local music.
