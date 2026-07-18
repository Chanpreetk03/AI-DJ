# AI-DJ LLM Task Backlog

Use these as small prompts for future coding sessions. Each task should leave the repo in a runnable or testable state.

## Foundation

- Create a TypeScript Node project skeleton with scripts for dev, build, and test.
- Add shared domain types for `VibeVector`, `RoomState`, `MusicParams`, and WebSocket messages.
- Add runtime validation for inbound WebSocket messages.
- Expand `README.md` with setup, run, and demo instructions.

## Pure Logic

- Implement `RoomAggregator.ingest(clientId, vibe, now)`.
- Implement `RoomAggregator.currentState(now)`.
- Add stale-client decay after 2 seconds without a vibe message.
- Add room state machine behavior for idle, warming, active, and cooling.
- Implement `VibeToMusicMapper.map(state)`.
- Add hysteresis or smoothing to prevent flicker near thresholds.
- Write table-driven tests for aggregator scenarios.
- Write table-driven tests for mapper scenarios.

## Transport

- Implement a `ws` WebSocket server.
- Add `hello` client registration.
- Add `vibe` message ingestion.
- Add client timeout handling.
- Add optional `roomState` broadcasts.
- Implement `InMemoryTransport` for integration tests.
- Add a synthetic client script that sends scripted vibe curves.

## Client

- Build `client/index.html` with join and connected states.
- Implement `RealVibeSensor` using `getUserMedia`.
- Implement frame differencing for motion.
- Implement Web Audio RMS measurement.
- Implement rough onset-rate detection.
- Send vibe vectors every 200 ms.
- Add mic-only fallback when camera permission is denied.
- Add screen wake lock support.
- Add simple connection and contribution visualization.

## Synth

- Build a browser-based output page for the venue laptop.
- Connect the output page to the WebSocket server.
- Implement `RecordingSynthesizer` for tests.
- Implement `RealSynthesizer` with Tone.js or Web Audio.
- Add beat/bar quantization for parameter updates.
- Map `tempo`, `filterCutoff`, `noteDensity`, and `layerCount` to audible changes.
- Add audio ramps to avoid clicks.

## Integration

- Wire transport, aggregator, mapper, and synth together.
- Add a server status endpoint or dashboard.
- Test one real phone end-to-end.
- Test three clients using real or synthetic devices.
- Add a deterministic synthetic demo sequence.
- Add QR-code generation or display for the join URL.

## Demo Hardening

- Document the HTTPS setup chosen for mobile browser permissions.
- Add a fallback mode that works with only the laptop.
- Test on iOS Safari.
- Test on Android Chrome.
- Tune mapping curves for a clear demo response.
- Add troubleshooting notes for no camera, no mic, no socket, and no audio.
