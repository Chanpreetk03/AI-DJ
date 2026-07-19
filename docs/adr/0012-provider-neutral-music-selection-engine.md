# Provider-Neutral Music Selection Engine

## Context

AI-DJ now supports local music and an optional Spotify host player. We need both manual track selection and automatic selection based on Room State, language, and remix preference. Spotify does not provide a dependable track-language field, and protected Spotify audio must not be treated as input to our local mixer or an AI analysis pipeline.

## Decision

Create a provider-neutral `MusicSelectionEngine` that ranks Track Candidates using host-curated Track Profiles, Room State, language preferences, remix policy, explicit-content policy, and playback history. Keep catalog access and playback in separate provider Adapters.

Automatic mode will initially search Spotify for playlists using room-energy and language queries such as `calm English playlist` and `high energy remix Punjabi playlist`. Local AI-DJ playback remains the default and fallback. Spotify remixes are selected as existing track identities; AI-DJ will not generate or transform Spotify remixes.

## Consequences

- Manual duplicate-title resolution is explicit and explainable.
- Automatic language behavior is based on the host's language query and returned playlist metadata; it is not silent language inference from protected audio.
- The core selection tests do not require Spotify credentials or network access.
- Apple Music can later reuse the engine through new Adapters.
- Automatic Spotify playback must remain subject to Spotify policy review, especially around DJ/mixing and visual synchronization.
