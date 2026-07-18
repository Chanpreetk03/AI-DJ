# Product Requirements Document: AI-DJ

## Overview

AI-DJ is a crowd-reactive generative music system for a hackathon demo. Audience phones capture lightweight motion and audio features in the browser, stream those small "vibe vectors" to a local laptop server, and the server turns the aggregate room energy into live procedural music.

The intended experience is simple and visible: people join from their phones, move or make noise, and the music audibly changes within a beat or two.

## Goals

- Let one or more phones contribute real-time crowd energy without installing an app.
- Avoid streaming raw camera or microphone media off-device.
- Generate one continuous audio output from the laptop to the venue speakers.
- Make the reaction loop obvious enough for a live demo.
- Keep the implementation realistic for a 1-week, 2-person hackathon.

## Non-Goals

- No full neural music generation as the core audio engine.
- No raw video or audio streaming to the server.
- No per-phone synchronized audio playback.
- No durable accounts, database, analytics, or cloud deployment required for the MVP.
- No precise choreography or gesture recognition in the initial version.

## Target Users

- Hackathon judges who need to understand the causal loop quickly.
- Audience participants joining from mobile browsers.
- The project team running the laptop server and audio output.

## Core User Flows

### Participant joins

1. Participant scans a QR code pointing to the laptop server.
2. Browser opens the join page over HTTPS.
3. Participant taps join.
4. Browser asks for camera and microphone permission.
5. Client starts sending vibe vectors over WebSocket.
6. Participant sees lightweight feedback that they are connected.

### Room changes the music

1. Multiple clients send vibe vectors about 5 times per second.
2. Server aggregates client vectors into one room state.
3. Mapper converts room state into music parameters.
4. Synthesizer applies parameter changes on musical boundaries.
5. Audio output changes in tempo, density, filter, or active layers.

### Demo fallback

1. If phone capture or venue HTTPS setup fails, use a synthetic sensor or booth-device mode.
2. System still demonstrates quiet, building, peak, and cooldown states.

## Functional Requirements

### Client Vibe Sensor

- Capture camera and microphone input using browser APIs.
- Compute a `VibeVector` containing:
  - `motion`
  - `motionVariance`
  - `audioRms`
  - `onsetRate`
  - `timestamp`
- Emit vectors at roughly 5 Hz.
- Support a synthetic mode for local testing without real movement.
- Handle denied camera permission by falling back to mic-only when possible.
- Keep the screen awake when supported.

### Transport

- Use JSON over WebSocket.
- Support `hello` and `vibe` client messages.
- Optionally send `roomState` updates back to clients.
- Detect stale clients after about 2 seconds without messages.
- Keep reconnect and timeout behavior thin and predictable.

### Room Aggregation

- Aggregate one or more clients into:
  - `energy`
  - `coherence`
  - `activeClients`
- Decay stale client contributions toward neutral instead of freezing the last value.
- Accept `now` as an input for deterministic tests.
- Support idle, warming, active, and cooling behavior.

### Music Mapping

- Convert `RoomState` into:
  - `tempo`
  - `filterCutoff`
  - `noteDensity`
  - `layerCount`
- Use smoothing or hysteresis to avoid flickering behavior.
- Keep mapping pure and easy to unit test.
- Make high-energy changes obvious in the live demo.

### Synthesizer

- Produce continuous procedural music.
- Apply small parameter changes on beat boundaries.
- Apply tempo or structural changes on bar boundaries.
- Avoid clicks, pops, or abrupt mid-bar changes.
- Provide a recording/fake adapter for tests.

## Quality Requirements

- Raw vibe pipeline should stay under roughly 300 ms before musical quantization.
- Audible response should feel intentional within about 0.5 to 2 seconds.
- MVP should work on a local venue network without cloud hosting.
- System should remain useful with 1 phone and become more compelling with 3 or more.
- Core logic should be testable without camera, microphone, speakers, or WebSocket server.

## Technical Constraints

- Local laptop runs the Node.js server.
- Phones run browser clients.
- Camera and microphone require HTTPS secure context on mobile browsers.
- No raw media should leave participant devices.
- Prefer a small stack:
  - Node.js / TypeScript
  - `ws` for WebSockets
  - browser APIs for capture
  - Tone.js or Web Audio for synthesis

## MVP Scope

- Static join page served by the laptop.
- Real or synthetic vibe vector production.
- WebSocket server that accepts multiple clients.
- Room aggregation with stale-client decay.
- Pure vibe-to-music mapper.
- Procedural synth/output tab that reacts to mapped parameters.
- Basic demo controls or status panel showing connected clients and room energy.

## Stretch Scope

- Magenta.js or another lightweight melody generator, only if non-blocking.
- Better visual feedback on participant phones.
- QR-code display page.
- Calibration screen for venue noise and lighting.
- Multi-phone test harness with scripted scenarios.

## Success Metrics

- A new phone can join in under 30 seconds during a demo.
- The system works with at least 3 simultaneous phones.
- A quiet-to-energetic room transition audibly changes the music.
- A dropped phone does not leave the music stuck at high energy.
- The core mapper and aggregator can be tested with deterministic inputs.

## Open Questions

- Will the demo use pre-trusted local certificates, an HTTPS tunnel, or booth-device fallback?
- Will synthesis run headless on the server or inside a dedicated output browser tab?
- What exact music style should the procedural engine target for the demo?
- Which visual feedback is most useful on participant phones without distracting from the room?
