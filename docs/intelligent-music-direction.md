# Intelligent Music Direction

## Product promise

AI-DJ should feel like a responsive DJ set, not a metronome whose tempo changes. The crowd changes the musical direction, arrangement, and transition timing while the audio itself comes from real, licensed music assets.

## MVP architecture

1. Bundle 3 to 4 short, licensed track packs in `frontend/public/stems/`.
2. Each pack contains tempo-matched 8 or 16 bar loops: drums, bass, harmony, melody, and a full-mix fallback.
3. The browser preloads each pack, starts loops on the shared musical grid, and crossfades only at phrase boundaries.
4. The server remains authoritative for `RoomState` and `MusicParams`.
5. The output-side DJ brain maps room energy, change rate, coherence, and recent style history into an intent state: `warmup`, `groove`, `lift`, `peak`, or `recovery`.
6. A track/arrangement scorer chooses a compatible next pack using energy fit, novelty, harmonic compatibility, and transition safety. It must avoid repeating a recently selected pack.

## What makes it intelligent

The intelligence is a transparent real-time policy first, not an unreliable generative model:

- Persistent low energy selects or stays in `warmup`/`groove`.
- Sustained rising energy triggers `lift`, then `peak` after a phrase boundary.
- A sharp energy drop moves to `recovery` instead of immediately accelerating again.
- Low coherence reduces dense layers even if total energy is high.
- Recent selections are penalized to create deliberate variety.

This policy can later be replaced or tuned by a lightweight trained classifier using recorded vibe-vector sessions. The audio transport and pack metadata stay the same.

## Asset requirements

Use only assets with licenses that allow bundling and redistribution in this repository. Prefer creator-provided CC0 packs because CC0 permits copying, modification, distribution, and performance without permission. Keep the source URL and license text beside every downloaded asset. Do not use commercial songs or platform streams.

## Immediate implementation slice

1. Choose one CC0 or explicitly redistributable pack.
2. Add its license and stems under `frontend/public/stems/<pack-name>/`.
3. Replace the oscillator pack with an `AudioBuffer` stem player.
4. Add phrase-aligned crossfades and the five-state DJ policy.
5. Add two additional packs once the first transition is polished.

## Current library implementation

The browser now loads `frontend/public/stems/music-library.json` as the source of truth for track metadata, stem roles, phrase length, musical key, tags, and licensing references. Stem packs can expose multiple phrase variants per role; the output-side DJ chooses a compatible variant from room energy, rhythm density, melodic activity, and recent play history before starting the next phrase.

Adding a pack should therefore require a manifest entry and licensed assets, not edits to the audio decision code.
