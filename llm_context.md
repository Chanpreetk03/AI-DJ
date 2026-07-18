# AI-DJ LLM Context

Read this first before coding.

## Project Summary

AI-DJ is a hackathon-scale, crowd-reactive generative DJ system. Mobile browsers extract lightweight motion and microphone features, send them as JSON vibe vectors over SignalR to a local laptop server, and the server maps the aggregate room state to procedural music parameters.

The key product promise is: crowd energy changes the music live, without uploading raw camera or microphone streams.

## Existing Decisions

- Architecture: edge feature extraction plus centralized aggregation and generation.
- Network payload: small JSON vectors, not raw media.
- Deployment: one laptop on local venue Wi-Fi.
- Core transport: ASP.NET Core SignalR.
- Core audio: procedural synthesis in a dedicated browser output tab, likely Tone.js or Web Audio.
- Demo scope: reliable procedural music first, neural/generative flourishes only as stretch.

## Core Interfaces

```ts
type VibeVector = {
  motion: number;
  motionVariance: number;
  audioRms: number;
  onsetRate: number;
  timestamp: number;
};

type RoomState = {
  energy: number;
  coherence: number;
  activeClients: number;
};

type MusicParams = {
  tempo: number;
  filterCutoff: number;
  noteDensity: number;
  layerCount: number;
};
```

Expected modules:

- `VibeSensor`: browser camera/mic feature extraction.
- `Transport`: SignalR hub plumbing and client liveness.
- `RoomAggregator`: multi-client aggregation and stale decay.
- `VibeToMusicMapper`: pure mapping from room state to music params.
- `Synthesizer`: procedural audio output.

## Protocol

Client to server:

```json
{ "type": "hello", "clientId": "uuid" }
```

```json
{
  "type": "vibe",
  "motion": 0.62,
  "motionVariance": 0.18,
  "audioRms": 0.41,
  "onsetRate": 1.8,
  "ts": 1752345678123
}
```

Optional server to client:

```json
{ "type": "roomState", "energy": 0.71, "coherence": 0.55, "activeClients": 6 }
```

## Coding Guidance

- Build pure logic before browser/audio integration.
- Pass `now` into time-sensitive logic for deterministic tests.
- Use synthetic/fake adapters aggressively:
  - `SyntheticVibeSensor`
  - `InMemoryTransport`
  - `RecordingSynthesizer`
- Keep modules small and interfaces stable.
- Do not add a database or cloud dependency for the MVP.
- Do not send raw media to the server.
- Make demo behavior obvious before making it musically subtle.

## Important Demo Constraint

Mobile `getUserMedia` needs a secure context. `http://192.168.x.x` is usually not enough. Resolve HTTPS early with local certs, a tunnel, or a booth-device fallback.

## Suggested First Coding Prompt

Implement the .NET server skeleton, TypeScript browser client/output skeleton, shared message contracts, `RoomAggregator`, `VibeToMusicMapper`, and unit tests for quiet, rising, peak, stale-client, and cooldown scenarios. Keep browser capture and audio output as later tasks.
